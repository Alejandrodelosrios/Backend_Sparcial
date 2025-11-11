import path from "path";
import fs from "fs";
import archiver from "archiver";
import { response } from "../middlewares/catchedAsync.js";
import { getSalaById } from "../models/sala.model.js";
import { rm } from "fs/promises";

const rutaBase = "C:/Users/Public/Documents/proyectos";

class FlutterExportController {
  
  /**
   * Método principal para exportar código Flutter desde una sala
   */
  exportarFlutterDesdeSala = async (req, res) => {
    const { id } = req.params;
    try {
      console.log(`📱 Iniciando generación de Flutter para sala ${id}`);
      
      // 1. Obtener datos de la sala
      const [sala] = await getSalaById(id);
      if (!sala) {
        return response(res, 404, { error: "Sala no encontrada" });
      }
      if (!sala.xml || sala.xml.trim() === "") {
        return response(res, 400, {
          error: "La sala no tiene contenido XML para exportar",
        });
      }

      // 2. Parsear XML
      let salaData;
      try {
        salaData = JSON.parse(sala.xml);
      } catch (parseError) {
        console.error(`❌ Error parseando XML de sala:`, parseError);
        return response(res, 400, { error: "El XML de la sala no es válido" });
      }

      // 3. Procesar elementos
      let elements = [];
      if (salaData.elements) {
        if (Array.isArray(salaData.elements)) {
          elements = salaData.elements;
        } else if (typeof salaData.elements === "object") {
          elements = Object.values(salaData.elements);
        }
      }
      if (elements.length === 0) {
        return response(res, 400, {
          error: "No hay elementos UML en la sala para generar Flutter",
        });
      }

      // 4. Filtrar clases UML
      const classElements = elements.filter((el) => el.type === "class");
      if (classElements.length === 0) {
        return response(res, 400, {
          error: "No hay clases UML en la sala para generar modelos Flutter",
        });
      }

      // 5. Procesar conexiones
      let connections = [];
      if (salaData.connections) {
        if (Array.isArray(salaData.connections)) {
          connections = salaData.connections;
        } else if (typeof salaData.connections === "object") {
          connections = Object.values(salaData.connections);
        }
      }

      console.log(`🔄 Procesando ${classElements.length} clases y ${connections.length} conexiones`);

      // 6. Analizar relaciones para formularios dinámicos
      const formConfig = this.analizarRelacionesParaFormularios(classElements, connections);
      
      // ✅ Log de debug para verificar formConfig
      console.log(`\n🔍 FormConfig generado:`);

      Object.keys(formConfig).forEach(className => {
        console.log(`   ${className}:`, JSON.stringify(formConfig[className], null, 2));
      });

      // 7. Crear proyecto Flutter
      const projectName = `flutter_app_${sala.title
        .toLowerCase()
        .replace(/\s+/g, "_")}`;
      await this.crearProyectoFlutterCompleto(projectName, classElements, connections, formConfig);
      
      // 8. Comprimir y enviar
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.comprimirProyecto(projectName);
      await this.enviarZip(res, projectName);

      console.log(`✅ Proyecto Flutter generado exitosamente`);

    } catch (error) {
      console.error("❌ Error exportando Flutter desde sala:", error.message);
      return response(res, 500, {
        error: "Error exportando Flutter desde sala",
        detalles: error.message,
      });
    }
  };

  /**
   * Método auxiliar para capitalizar strings
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Normalizar multiplicidades (0..1, 1, 1..1, 1..*, 0..*, *..*) 
   */
  normalizarMultiplicidad(mult) {
    if (!mult || mult === '' || mult === '1') return '1';
    
    // Normalizar variantes
    const normalized = mult.trim().replace(/\s+/g, '');
    
    // Mapeo de variantes comunes
    const mappings = {
      '0..1': '0..1',
      '1..1': '1',
      '1..*': '*',
      '0..*': '*',
      '*': '*',
      '*..*': '*',
      'n': '*',
      'N': '*',
      'm': '*',
      'M': '*'
    };
    
    return mappings[normalized] || normalized;
  }

  /**
   * Analizar relaciones para generar configuración de formularios dinámicos
   * Similar a crearPaginaController pero adaptado para Flutter
   * ✅ SOPORTA: 0..1, 1, 1..1, 1..*, 0..*, *..* 
   */
  analizarRelacionesParaFormularios(classes, connections) {
  const formConfig = {};
  
  // Crear mapa de elementos por ID
  const elementMap = new Map();
  classes.forEach(cls => {
    elementMap.set(cls.id, cls);
    formConfig[cls.name] = {
      fields: cls.attributes || [],
      relationships: [],   
      relationsIn: [],     
      relationsOut: []     
    };
  });

  console.log(`\n🔗 Analizando ${connections.length} relaciones para Flutter...`);

  // Analizar cada conexión
  connections.forEach((conn, index) => {
    const sourceElement = elementMap.get(conn.source);
    const targetElement = elementMap.get(conn.target);
    
    if (!sourceElement || !targetElement) {
      console.log(`   ⚠️  Relación ${index + 1}: Elemento no encontrado (${conn.source} -> ${conn.target})`);
      return;
    }
    
    // ✅ Normalizar multiplicidades
    const sourceMult = this.normalizarMultiplicidad(conn.sourceMultiplicity || "1");
    const targetMult = this.normalizarMultiplicidad(conn.targetMultiplicity || "1");
    const relationType = conn.type || "association";
    
    console.log(`   📌 Relación ${index + 1}: ${sourceElement.name} (${conn.sourceMultiplicity || '1'} → ${sourceMult}) --[${relationType}]--> ${targetElement.name} (${conn.targetMultiplicity || '1'} → ${targetMult})`);
    
    // Determinar widget Flutter según tipo de relación y multiplicidad
    let fieldType, widget, description, isEmbedded = false;
    
    // === COMPOSICIÓN (●) ===
    if (relationType === "composition") {
      fieldType = "EMBEDDED_FORM";
      widget = "EmbeddedFormListView";
      description = "Subformulario embebido (los objetos hijos se crean/eliminan con el padre)";
      isEmbedded = true;
      console.log(`      → Widget: ${widget} (Composición)`);
    }
    // === AGREGACIÓN (◇) ===
    else if (relationType === "aggregation") {
      if (targetMult === "*") {
        fieldType = "MULTI_SELECT";
        widget = "MultiSelectChipField";
        description = "Lista seleccionable (los objetos existen independientemente)";
      } else {
        fieldType = "DROPDOWN";
        widget = "DropdownButtonFormField";
        description = "Dropdown de selección única (agregación)";
      }
      console.log(`      → Widget: ${widget} (Agregación)`);
    }
    // === HERENCIA (▷) ===
    else if (relationType === "inheritance" || relationType === "generalization") {
      fieldType = "INHERITANCE";
      widget = "InheritedFields";
      description = "Incluir campos de la clase padre";
      console.log(`      → Widget: ${widget} (Herencia)`);
      
      if (formConfig[sourceElement.name]) {
        formConfig[sourceElement.name].extendsFrom = targetElement.name;
        formConfig[sourceElement.name].parentFields = targetElement.attributes || [];
      }
      return; // No agregar como relación normal
    }
    // === ASOCIACIÓN SIMPLE ===
    else {
      // 1..1 (Uno a Uno)
      if (sourceMult === "1" && targetMult === "1") {
        fieldType = "DROPDOWN_SINGLE";
        widget = "DropdownButtonFormField";
        description = "Selección única obligatoria (asociación 1..1)";
      }
      // 1..* (Uno a Muchos)
      else if (sourceMult === "1" && targetMult === "*") {
        fieldType = "MULTI_SELECT_CHECKBOXES";
        widget = "CheckboxListView";
        description = "Lista de checkboxes (1..*)";
      }
      // *..1 (Muchos a Uno)
      else if (sourceMult === "*" && targetMult === "1") {
        fieldType = "DROPDOWN_SINGLE";
        widget = "DropdownButtonFormField";
        description = "Selección única en entidad hija (*.1)";
      }
      // *..* (Muchos a Muchos)
      else if (sourceMult === "*" && targetMult === "*") {
        fieldType = "MULTI_SELECT_CHIPS";
        widget = "WrapChoiceChip";
        description = "Chips seleccionables (*..*)";
      }
      // Default
      else {
        fieldType = "DROPDOWN";
        widget = "DropdownButtonFormField";
        description = "Dropdown de selección";
      }
      console.log(`      → Widget: ${widget} (${description})`);
    }
    
    // ✅ REGLA CLAVE: FK SIEMPRE EN TARGET (igual que Spring Boot con @JoinColumn)
    // Source -> Target: La FK está en Target (apunta hacia Source)
    // Usuario (source) -> Pedido (target): FK en Pedido
    let classWithFK, relatedClass, fkFieldName, fkMult, relatedMult, isOptional = false;
    
    // Detectar si es opcional (0..1 o 0..*)
    const sourceIsOptional = conn.sourceMultiplicity?.startsWith('0');
    const targetIsOptional = conn.targetMultiplicity?.startsWith('0');
    
    if (sourceMult === "*" && targetMult !== "*") {
      // Source * -> Target 1: FK en TARGET (hacia Source)
      classWithFK = targetElement.name;
      relatedClass = sourceElement.name;
      fkFieldName = sourceElement.name.toLowerCase();
      fkMult = sourceMult;
      relatedMult = targetMult;
      isOptional = sourceIsOptional;
      console.log(`      ✅ FK en: ${classWithFK} (TARGET) apunta a ${relatedClass} (SOURCE)`);
      console.log(`      ⚠️  ${relatedClass} NO tiene FK (es mappedBy en Spring Boot)`);
    } else if (targetMult === "*" && sourceMult !== "*") {
      // Source 1 -> Target *: FK en TARGET (hacia Source)
      classWithFK = targetElement.name;
      relatedClass = sourceElement.name;
      fkFieldName = sourceElement.name.toLowerCase();
      fkMult = targetMult;
      relatedMult = sourceMult;
      isOptional = sourceIsOptional;
      console.log(`      ✅ FK en: ${classWithFK} (TARGET - lado muchos) apunta a ${relatedClass} (SOURCE)`);
      console.log(`      ⚠️  ${relatedClass} NO tiene FK (es mappedBy en Spring Boot)`);
    } else if ((sourceMult === "1" || sourceMult === "0..1") && (targetMult === "1" || targetMult === "0..1")) {
      // Relación 1..1 o 0..1 → FK en TARGET (Pedido tiene usuario)
      classWithFK = targetElement.name;
      relatedClass = sourceElement.name;
      fkFieldName = sourceElement.name.toLowerCase();
      fkMult = sourceMult;
      relatedMult = targetMult;
      isOptional = sourceIsOptional;
      console.log(`      ✅ FK en: ${classWithFK} (TARGET - relación 1..1) apunta a ${relatedClass} (SOURCE)`);
      console.log(`      ⚠️  ${relatedClass} NO tiene FK (es mappedBy en Spring Boot)`);
    } else if (sourceMult === "*" && targetMult === "*") {
      console.log(`      ⚠️  Relación *..*: No se genera FK directa (tabla intermedia)`);
      // Guardar en ambos lados
      if (formConfig[sourceElement.name]) {
        formConfig[sourceElement.name].relationsOut.push({
          targetClass: targetElement.name,
          fieldName: `${targetElement.name.toLowerCase()}Ids`,
          fieldType: "MULTI_SELECT_CHIPS",
          widget: "WrapChoiceChip",
          description: `Lista de ${targetElement.name}s relacionados`,
          relationshipType: relationType,
          isManyToMany: true
        });
      }
      if (formConfig[targetElement.name]) {
        formConfig[targetElement.name].relationsIn.push({
          sourceClass: sourceElement.name,
          fieldName: `${sourceElement.name.toLowerCase()}Ids`,
          description: `Lista de ${sourceElement.name}s relacionados`,
          relationshipType: relationType,
          isManyToMany: true
        });
      }
      return;
    } else {
      console.log(`      ⚠️  Relación desconocida: ${sourceMult}..${targetMult}`);
      return;
    }

    // ✅ Agregar relación saliente (FK) - SOLO en classWithFK (TARGET)
    const relOut = {
      targetClass: relatedClass,
      targetClassLower: relatedClass.toLowerCase(),
      fieldName: fkFieldName,
      fieldType,
      widget,
      description,
      relationshipType: relationType,
      sourceMult: fkMult,
      targetMult: relatedMult,
      cardinality: `${fkMult}..${relatedMult}`,
      isEmbedded,
      isRequired: !isOptional,
      isOptional: isOptional
    };
    formConfig[classWithFK].relationsOut.push(relOut);
    console.log(`      ✅ relationsOut agregada a ${classWithFK}: campo '${fkFieldName}' apunta a ${relatedClass}`);

    // ✅ Agregar relación entrante (mappedBy) - SOLO para referencia, NO genera campo
    const relIn = {
      sourceClass: classWithFK,
      sourceClassLower: classWithFK.toLowerCase(),
      fieldName: `${classWithFK.toLowerCase()}`,
      relationshipType: relationType,
      sourceMult: relatedMult,
      targetMult: fkMult,
      cardinality: `${relatedMult}..${fkMult}`,
      description: `Relación inversa - NO genera campo (mappedBy en Spring Boot)`,
      isMappedBy: true // ✅ CLAVE: Marca que NO debe generar campo en el modelo
    };
    formConfig[relatedClass].relationsIn.push(relIn);
    console.log(`      ℹ️  relationsIn agregada a ${relatedClass}: NO genera campo (mappedBy)`);

    // ✅ NUEVO: Consolidar relación global (clave del FIX)
    if (formConfig[classWithFK]) {
      formConfig[classWithFK].relationships.push({
        direction: "OUT",
        ...relOut
      });
    }
    if (formConfig[relatedClass]) {
      formConfig[relatedClass].relationships.push({
        direction: "IN",
        ...relIn
      });
    }
  });

  // Log resumen
  console.log(`\n📊 Resumen de relaciones Flutter:`);
  Object.keys(formConfig).forEach(className => {
    const config = formConfig[className];
    const outCount = config.relationsOut.length;
    const inCount = config.relationsIn.length;
    const inheritanceInfo = config.extendsFrom ? ` (hereda de ${config.extendsFrom})` : '';
    console.log(`   ${className}: ${outCount} salientes, ${inCount} entrantes${inheritanceInfo}`);
  });

  return formConfig;
}

  /**
   * Crear proyecto Flutter completo
   */
  async crearProyectoFlutterCompleto(projectName, classes, connections, formConfig) {
    const projectPath = path.join(rutaBase, projectName);

    // Crear estructura de directorios
    const directories = [
      "lib",
      "lib/models",
      "lib/screens",
      "lib/services",
      "lib/providers",
      "lib/widgets",
      "lib/widgets/form_fields",
    ];

    for (const dir of directories) {
      const fullPath = path.join(projectPath, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }

    // Generar archivos principales
    this.generarPubspecYaml(projectPath, projectName);
    this.generarMainDart(projectPath, classes);
    this.generarApiConfig(projectPath);
    
    // ✅ Crear mapa de nombres de ID para cada clase
    const idFieldMap = {};
    classes.forEach(cls => {
      const idField = cls.attributes?.find(a => a.isPrimaryKey);
      idFieldMap[cls.name] = idField ? idField.name : 'id';
    });
    
    console.log(`\n🔑 Mapa de campos ID detectados:`);
    Object.keys(idFieldMap).forEach(className => {
      console.log(`   ${className}: "${idFieldMap[className]}"`);
    });
    
    // Generar modelos, servicios, providers y pantallas para cada clase
    for (const cls of classes) {
      const idFieldName = idFieldMap[cls.name];
      
      this.generarModelo(projectPath, cls, formConfig[cls.name]);
      this.generarServicio(projectPath, cls, idFieldName);
      this.generarProvider(projectPath, cls, idFieldName);
      this.generarPantallas(projectPath, cls, formConfig[cls.name], idFieldName, idFieldMap);
    }

    // Generar widgets personalizados
    this.generarDashboardCard(projectPath);
    this.generarDashboard(projectPath, classes);
    this.generarFormWidgets(projectPath);
  }

  /**
   * Generar pubspec.yaml
   */
  generarPubspecYaml(projectPath, projectName) {
    const content = `name: ${projectName}
description: Aplicación Flutter generada desde diagrama UML
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6
  provider: ^6.1.1
  http: ^1.1.2
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1

flutter:
  uses-material-design: true
`;

    fs.writeFileSync(path.join(projectPath, "pubspec.yaml"), content);
  }

  /**
   * Generar main.dart
   */
  generarMainDart(projectPath, classes) {
    const providerImports = classes
      .map(cls => `import 'providers/${cls.name.toLowerCase()}_provider.dart';`)
      .join("\n");
    
    const providers = classes
      .map(cls => `        ChangeNotifierProvider(create: (_) => ${cls.name}Provider()),`)
      .join("\n");
    
    const content = `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/dashboard_screen.dart';
${providerImports}

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
${providers}
      ],
      child: MaterialApp(
        title: 'UML Generated App',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
          useMaterial3: true,
          cardTheme: CardThemeData(
            elevation: 4,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        home: const DashboardScreen(),
      ),
    );
  }
}
`;

    fs.writeFileSync(path.join(projectPath, "lib/main.dart"), content);
  }

  /**
   * Generar configuración de API
   */
  generarApiConfig(projectPath) {
    const content = `import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiConfig {
  // ⚠️ IMPORTANTE: Cambiar esta URL por la URL de tu backend Spring Boot
  // Ejemplos:
  // - Desarrollo local (Android Emulator): 'http://10.0.2.2:8080/api'
  // - Desarrollo local (iOS Simulator): 'http://localhost:8080/api'
  // - Desarrollo local (Dispositivo físico): 'http://192.168.x.x:8080/api'
  // - Producción: 'https://tu-dominio.com/api'
  static const String baseUrl = 'http://10.0.2.2:8080/api';
  
  // Headers comunes para todas las peticiones
  static Map<String, String> get headers => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  // Método auxiliar GET
  static Future<http.Response> get(String endpoint) async {
    final url = Uri.parse('\$baseUrl\$endpoint');
    print('🌐 GET: \$url');
    try {
      return await http.get(url, headers: headers);
    } catch (e) {
      print('❌ Error GET: \$e');
      rethrow;
    }
  }
  
  // Método auxiliar POST
  static Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    final url = Uri.parse('\$baseUrl\$endpoint');
    print('🌐 POST: \$url');
    print('📦 Body: \${jsonEncode(body)}');
    try {
      return await http.post(url, headers: headers, body: jsonEncode(body));
    } catch (e) {
      print('❌ Error POST: \$e');
      rethrow;
    }
  }
  
  // Método auxiliar PUT
  static Future<http.Response> put(String endpoint, Map<String, dynamic> body) async {
    final url = Uri.parse('\$baseUrl\$endpoint');
    print('🌐 PUT: \$url');
    print('📦 Body: \${jsonEncode(body)}');
    try {
      return await http.put(url, headers: headers, body: jsonEncode(body));
    } catch (e) {
      print('❌ Error PUT: \$e');
      rethrow;
    }
  }
  
  // Método auxiliar DELETE
  static Future<http.Response> delete(String endpoint) async {
    final url = Uri.parse('\$baseUrl\$endpoint');
    print('🌐 DELETE: \$url');
    try {
      return await http.delete(url, headers: headers);
    } catch (e) {
      print('❌ Error DELETE: \$e');
      rethrow;
    }
  }
  
  // Manejo de errores HTTP
  static void handleError(http.Response response) {
    if (response.statusCode >= 400) {
      print('❌ Error HTTP \${response.statusCode}: \${response.body}');
      throw Exception('Error en la petición: \${response.statusCode}');
    }
  }
}
`;

    fs.writeFileSync(path.join(projectPath, "lib/services/api_config.dart"), content);
  }

  /**
   * Generar modelo Dart CON soporte para relaciones
   * 
   * ✅ SOLUCIÓN AL PROBLEMA DE SERIALIZACIÓN:
   * - Los nombres de campos en toJson() y fromJson() COINCIDEN EXACTAMENTE con @JsonProperty del backend
   * - Spring Boot usa @JsonProperty para forzar nombres (ej: "Nombre", "Email", "ID")
   * - Flutter usa los mismos nombres en JSON para perfecta compatibilidad
   * - Esto evita que Jackson convierta automáticamente a camelCase (nombre → Nombre)
   */
  generarModelo(projectPath, cls, formConfig) {
    const className = cls.name;
    const attributes = cls.attributes || [];
    
    // ✅ Detectar el nombre real del campo ID (puede ser 'id', 'ID', 'Id', etc.)
    const idField = attributes.find(a => a.isPrimaryKey);
    const idFieldName = idField ? idField.name : 'id';
    console.log(`\n📝 Generando modelo: ${className}.dart`);
    console.log(`   🔑 Campo ID detectado: "${idFieldName}"`);
    console.log(`   ✅ Generando JSON con nombres EXACTOS para coincidir con @JsonProperty del backend`);
    console.log(`   📋 Atributos: ${attributes.length}`);
    console.log(`   🔗 FormConfig recibido:`, formConfig ? 'SÍ' : 'NO');
    
    if (formConfig) {
      console.log(`   📤 Relaciones OUT: ${formConfig.relationsOut?.length || 0}`);
      console.log(`   📥 Relaciones IN: ${formConfig.relationsIn?.length || 0}`);
      if (formConfig.relationsOut && formConfig.relationsOut.length > 0) {
        formConfig.relationsOut.forEach(rel => {
          console.log(`      → ${rel.fieldName} (${rel.cardinality})`);
        });
      }
    }
    
    // ✅ Generar imports de clases relacionadas (similar a Java con import *)
    let imports = '';
    const relatedClasses = new Set();
    
    // Recolectar clases relacionadas desde relationsOut
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      formConfig.relationsOut.forEach(rel => {
        if (rel.relationshipType !== 'inheritance') {
          relatedClasses.add(rel.targetClass);
        }
      });
    }
    
    // Recolectar clase padre si existe herencia
    if (formConfig && formConfig.extendsFrom) {
      relatedClasses.add(formConfig.extendsFrom);
    }
    
    // Generar imports
    if (relatedClasses.size > 0) {
      imports = Array.from(relatedClasses)
        .map(relClass => `import '${relClass.toLowerCase()}.dart';`)
        .join('\n') + '\n\n';
      console.log(`   ✅ Imports agregados: ${Array.from(relatedClasses).join(', ')}`);
    }
    
    // Generar campos base
    const fields = attributes.map(attr => {
      const dartType = this.mapTipoDart(attr.type);
      const nullable = attr.isPrimaryKey ? '?' : '';
      return `  final ${dartType}${nullable} ${attr.name};`;
    }).join("\n");
    
    // ✅ Generar campos SOLO para relationsOut (tienen FK - igual que @ManyToOne/@OneToOne en Spring Boot)
    let relationFields = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      console.log(`   🔧 Generando ${formConfig.relationsOut.length} campos de relación (con FK)...`);
      relationFields = '\n\n  // ===== RELACIONES (tienen FK - igual que @ManyToOne/@OneToOne en Spring Boot) =====';

      formConfig.relationsOut.forEach(rel => {
        console.log(`      ✅ Agregando campo: ${rel.fieldName} → ${rel.targetClass}`);
        if (rel.relationshipType !== 'inheritance') {
          if (rel.isManyToMany || rel.targetMult === '*') {
            // Lista de objetos (@OneToMany en Spring Boot)
            relationFields += `\n  final List<${rel.targetClass}>? ${rel.targetClassLower}s; // ${rel.cardinality} - ${rel.description}`;
          } else {
            // Objeto único (@ManyToOne/@OneToOne en Spring Boot - tiene FK)
            relationFields += `\n  final ${rel.targetClass}? ${rel.fieldName}; // ${rel.cardinality} - ${rel.description}`;
          }
        }
      });
    } else {
      console.log(`   ⚠️  Sin relaciones OUT para ${className}`);
    }
    
    // ✅ NO generar campos para relationsIn (son @OneToOne mappedBy / @OneToMany mappedBy)
    if (formConfig && formConfig.relationsIn && formConfig.relationsIn.length > 0) {
      console.log(`   ℹ️  ${className} tiene ${formConfig.relationsIn.length} relaciones IN (mappedBy) - NO se generan campos`);
      formConfig.relationsIn.forEach(rel => {
        console.log(`      ⚠️  Ignorando relación inversa desde: ${rel.sourceClass} (es mappedBy en Spring Boot)`);
      });
    }
    
    // Generar constructor
    let constructorParams = attributes.map(attr => {
      const required = attr.isPrimaryKey ? '' : 'required ';
      return `    ${required}this.${attr.name},`;
    }).join("\n");
    
    // Agregar parámetros de relaciones (solo objetos - igual que Spring Boot)
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      formConfig.relationsOut.forEach(rel => {
        if (rel.relationshipType !== 'inheritance') {
          // Siempre opcional porque puede venir solo {id} o el objeto completo
          constructorParams += `\n    this.${rel.targetClassLower}${rel.isManyToMany || rel.targetMult === '*' ? 's' : ''},`;
        }
      });
    }
    
    // Generar toJson
    let toJsonFields = attributes.map(attr => {
      const dartType = this.mapTipoDart(attr.type);
      if (dartType === 'DateTime') {
        return `      '${attr.name}': ${attr.name}${attr.isPrimaryKey ? '?' : ''}.toIso8601String(),`;
      }
      return `      '${attr.name}': ${attr.name},`;
    }).join("\n");
    
    // Agregar relaciones al JSON (envía objeto completo o null - Spring Boot lo maneja)
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      formConfig.relationsOut.forEach(rel => {
        if (rel.relationshipType !== 'inheritance') {
          if (rel.isManyToMany || rel.targetMult === '*') {
            // Lista de objetos (@OneToMany en Spring Boot)
            toJsonFields += `\n      '${rel.targetClassLower}s': ${rel.targetClassLower}s?.map((e) => e.toJson()).toList(),`;
          } else {
            // Objeto único (@ManyToOne/@OneToOne en Spring Boot)
            // Usar el nombre del campo correcto (ej: 'usuario' no 'usuarioId')
            toJsonFields += `\n      '${rel.fieldName}': ${rel.fieldName}?.toJson(),`;
          }
        }
      });
    }
    
    // Generar fromJson con manejo robusto de tipos
    let fromJsonFields = attributes.map(attr => {
      const dartType = this.mapTipoDart(attr.type);
      const isNullable = attr.isPrimaryKey || attr.isOptional;
      
      if (dartType === 'int') {
        // int: Puede ser null o tener valor
        if (isNullable) {
          return `      ${attr.name}: json['${attr.name}'] != null ? json['${attr.name}'] as int : null,`;
        } else {
          return `      ${attr.name}: json['${attr.name}'] as int? ?? 0,`;
        }
      } else if (dartType === 'double') {
        // double: Convertir desde num y manejar null
        if (isNullable) {
          return `      ${attr.name}: json['${attr.name}'] != null ? (json['${attr.name}'] as num).toDouble() : null,`;
        } else {
          return `      ${attr.name}: json['${attr.name}'] != null ? (json['${attr.name}'] as num).toDouble() : 0.0,`;
        }
      } else if (dartType === 'bool') {
        // bool: Manejar null con valor por defecto false
        if (isNullable) {
          return `      ${attr.name}: json['${attr.name}'] != null ? json['${attr.name}'] as bool : null,`;
        } else {
          return `      ${attr.name}: json['${attr.name}'] as bool? ?? false,`;
        }
      } else if (dartType === 'DateTime') {
        // DateTime: Parsear fecha o usar DateTime.now() como fallback
        if (isNullable) {
          return `      ${attr.name}: json['${attr.name}'] != null ? DateTime.parse(json['${attr.name}']) : null,`;
        } else {
          return `      ${attr.name}: json['${attr.name}'] != null ? DateTime.parse(json['${attr.name}']) : DateTime.now(),`;
        }
      } else {
        // String: Manejar null
        if (isNullable) {
          return `      ${attr.name}: json['${attr.name}'] as String?,`;
        } else {
          return `      ${attr.name}: json['${attr.name}'] as String? ?? '',`;
        }
      }
    }).join("\n");
    
    // Agregar relaciones al fromJson (parsear objetos anidados - Spring Boot puede enviar objeto completo o solo {id})
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      formConfig.relationsOut.forEach(rel => {
        if (rel.relationshipType !== 'inheritance') {
          if (rel.isManyToMany || rel.targetMult === '*') {
            // Lista de objetos (@OneToMany en Spring Boot)
            fromJsonFields += `\n      ${rel.targetClassLower}s: json['${rel.targetClassLower}s'] != null ? (json['${rel.targetClassLower}s'] as List).map((e) => ${rel.targetClass}.fromJson(e)).toList() : null,`;
          } else {
            // Objeto único (@ManyToOne/@OneToOne en Spring Boot)
            // Usar el nombre del campo correcto (ej: 'usuario' no 'usuarioId')
            fromJsonFields += `\n      ${rel.fieldName}: json['${rel.fieldName}'] != null ? ${rel.targetClass}.fromJson(json['${rel.fieldName}']) : null,`;
          }
        }
      });
    }
    
    const content = `import 'dart:convert';
${imports}class ${className} {
${fields}${relationFields}

  ${className}({
${constructorParams}
  });

  // Convertir objeto a JSON
  Map<String, dynamic> toJson() => {
${toJsonFields}
  };

  // Crear objeto desde JSON
  factory ${className}.fromJson(Map<String, dynamic> json) => ${className}(
${fromJsonFields}
  );

  // Serialización a String
  String toJsonString() => jsonEncode(toJson());

  // Deserialización desde String
  static ${className} fromJsonString(String str) => 
      ${className}.fromJson(jsonDecode(str));

  @override
  String toString() {
    return '${className}(${attributes.map(a => `${a.name}: \$${a.name}`).join(', ')})';
  }
}
`;

    fs.writeFileSync(
      path.join(projectPath, `lib/models/${className.toLowerCase()}.dart`),
      content
    );
    
    console.log(`   ✅ Modelo ${className}.dart generado exitosamente`);
  }

  /**
   * Mapear tipos Java/UML a Dart
   */
  mapTipoDart(type) {
    const typeMap = {
      'String': 'String',
      'string': 'String',
      'int': 'int',
      'Integer': 'int',
      'long': 'int',
      'Long': 'int',
      'double': 'double',
      'Double': 'double',
      'float': 'double',
      'Float': 'double',
      'boolean': 'bool',
      'Boolean': 'bool',
      'bool': 'bool',
      'Date': 'DateTime',
      'DateTime': 'DateTime',
      'LocalDate': 'DateTime',
      'LocalDateTime': 'DateTime'
    };
    
    return typeMap[type] || 'String';
  }

  /**
   * Generar servicio API
   */
  generarServicio(projectPath, cls, idFieldName = 'id') {
    const className = cls.name;
    const endpoint = `/${className.toLowerCase()}`;
    
    const content = `import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/${className.toLowerCase()}.dart';
import 'api_config.dart';

class ${className}Service {
  // Endpoint de la API para ${className}
  // ⚠️ NOTA: Este endpoint debe coincidir con tu backend Spring Boot
  // Por ejemplo, si tu controlador es @RequestMapping("/api/usuarios")
  // entonces el endpoint debe ser '/usuarios'
  static const String endpoint = '${endpoint}';
  
  /// Obtener todos los registros
  static Future<List<${className}>> getAll() async {
    try {
      final response = await ApiConfig.get(endpoint);
      ApiConfig.handleError(response);
      
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => ${className}.fromJson(json)).toList();
    } catch (e) {
      print('❌ Error obteniendo ${className}s: \$e');
      rethrow;
    }
  }
  
  /// Obtener un registro por ID
  static Future<${className}> getById(int id) async {
    try {
      final response = await ApiConfig.get('\$endpoint/\$id');
      ApiConfig.handleError(response);
      
      return ${className}.fromJson(jsonDecode(response.body));
    } catch (e) {
      print('❌ Error obteniendo ${className} \$id: \$e');
      rethrow;
    }
  }
  
  /// Crear un nuevo registro
  static Future<${className}> create(${className} item) async {
    try {
      final response = await ApiConfig.post(endpoint, item.toJson());
      ApiConfig.handleError(response);
      
      return ${className}.fromJson(jsonDecode(response.body));
    } catch (e) {
      print('❌ Error creando ${className}: \$e');
      rethrow;
    }
  }
  
  /// Actualizar un registro existente
  static Future<${className}> update(int id, ${className} item) async {
    try {
      final response = await ApiConfig.put('\$endpoint/\$id', item.toJson());
      ApiConfig.handleError(response);
      
      return ${className}.fromJson(jsonDecode(response.body));
    } catch (e) {
      print('❌ Error actualizando ${className} \$id: \$e');
      rethrow;
    }
  }
  
  /// Eliminar un registro
  static Future<void> delete(int id) async {
    try {
      final response = await ApiConfig.delete('\$endpoint/\$id');
      ApiConfig.handleError(response);
    } catch (e) {
      print('❌ Error eliminando ${className} \$id: \$e');
      rethrow;
    }
  }
}
`;

    fs.writeFileSync(
      path.join(projectPath, `lib/services/${className.toLowerCase()}_service.dart`),
      content
    );
  }

  /**
   * Generar provider (gestión de estado)
   */
  generarProvider(projectPath, cls, idFieldName = 'id') {
    const className = cls.name;
    
    const content = `import 'package:flutter/foundation.dart';
import '../models/${className.toLowerCase()}.dart';
import '../services/${className.toLowerCase()}_service.dart';

class ${className}Provider with ChangeNotifier {
  List<${className}> _items = [];
  bool _isLoading = false;
  String? _error;
  
  List<${className}> get items => _items;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  /// Cargar todos los registros
  Future<void> loadAll() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      _items = await ${className}Service.getAll();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }
  
  /// Obtener un registro por ID
  ${className}? getById(int id) {
    try {
      return _items.firstWhere((item) => item.${idFieldName} == id);
    } catch (e) {
      return null;
    }
  }
  
  /// Crear un nuevo registro
  Future<bool> create(${className} item) async {
    try {
      final created = await ${className}Service.create(item);
      _items.add(created);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
  
  /// Actualizar un registro
  Future<bool> update(int id, ${className} item) async {
    try {
      final updated = await ${className}Service.update(id, item);
      final index = _items.indexWhere((i) => i.${idFieldName} == id);
      if (index != -1) {
        _items[index] = updated;
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
  
  /// Eliminar un registro
  Future<bool> delete(int id) async {
    try {
      await ${className}Service.delete(id);
      _items.removeWhere((item) => item.${idFieldName} == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
`;

    fs.writeFileSync(
      path.join(projectPath, `lib/providers/${className.toLowerCase()}_provider.dart`),
      content
    );
  }

  // Continúa en la siguiente parte...
  
  comprimirProyecto = async (titulo) => {
    const rutaFinal = path.join(rutaBase, titulo);
    const zipPath = path.join(rutaBase, `${titulo}.zip`);
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve());
      archive.on("error", (err) => reject(err));
      archive.pipe(output);
      archive.directory(rutaFinal, false);
      archive.finalize();
    });
  };

  enviarZip = async (res, titulo) => {
    const rutaFinal = path.join(rutaBase, titulo);
    const zipPath = path.join(rutaBase, `${titulo}.zip`);
    try {
      const zipBuffer = fs.readFileSync(zipPath);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${titulo}.zip`
      );
      res.send(zipBuffer);
      await rm(rutaFinal, { recursive: true, force: true });
      await rm(zipPath, { force: true });
    } catch (error) {
      console.error("❌ Error al enviar o limpiar:", error.message);
      throw error;
    }
  };

  /**
   * Generar pantallas CRUD
   */
  generarPantallas(projectPath, cls, formConfig, idFieldName = 'id', idFieldMap = {}) {
    const className = cls.name;
    const lowerName = className.toLowerCase();
    const dirPath = path.join(projectPath, `lib/screens/${lowerName}`);
    
    // Crear directorio para las pantallas
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Generar pantallas
    this.generarPantallaLista(dirPath, cls, idFieldName);
    this.generarPantallaFormulario(dirPath, cls, formConfig, idFieldName, idFieldMap);
    this.generarPantallaDetalle(dirPath, cls, formConfig, idFieldName);
  }

  /**
   * Generar pantalla de lista
   */
  generarPantallaLista(dirPath, cls, idFieldName = 'id') {
    const className = cls.name;
    const lowerName = className.toLowerCase();
    
    // Obtener primer atributo String para mostrar
    const firstStringAttr = cls.attributes?.find(a => a.type === 'String' && !a.isPrimaryKey);
    const displayField = firstStringAttr ? `item.${firstStringAttr.name}` : `'${className} #\${item.${idFieldName}}'`;
    
    const content = `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/${lowerName}.dart';
import '../../providers/${lowerName}_provider.dart';
import '${lowerName}_form_screen.dart';
import '${lowerName}_detail_screen.dart';

class ${className}ListScreen extends StatefulWidget {
  const ${className}ListScreen({super.key});

  @override
  State<${className}ListScreen> createState() => _${className}ListScreenState();
}

class _${className}ListScreenState extends State<${className}ListScreen> {
  @override
  void initState() {
    super.initState();
    // Cargar datos al iniciar la pantalla
    Future.microtask(() => 
      Provider.of<${className}Provider>(context, listen: false).loadAll()
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${className}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              Provider.of<${className}Provider>(context, listen: false).loadAll();
            },
          ),
        ],
      ),
      body: Consumer<${className}Provider>(
        builder: (context, provider, child) {
          // Mostrar indicador de carga
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          
          // Mostrar error si existe
          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Error: \${provider.error}'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.loadAll(),
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }
          
          // Mostrar mensaje si no hay datos
          if (provider.items.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inbox, size: 48, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No hay registros'),
                ],
              ),
            );
          }
          
          // Mostrar lista de items
          return ListView.builder(
            itemCount: provider.items.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final item = provider.items[index];
              return Card(
                margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                child: ListTile(
                  title: Text(${displayField}),
                  subtitle: Text('ID: \${item.${idFieldName}}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit, color: Colors.blue),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ${className}FormScreen(item: item),
                            ),
                          );
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red),
                        onPressed: () => _confirmDelete(context, provider, item.${idFieldName}!),
                      ),
                    ],
                  ),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ${className}DetailScreen(item: item),
                      ),
                    );
                  },
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const ${className}FormScreen(),
            ),
          );
        },
      ),
    );
  }
  
  // Confirmar eliminación
  void _confirmDelete(BuildContext context, ${className}Provider provider, int id) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar eliminación'),
        content: const Text('¿Está seguro de eliminar este registro?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(context);
              final success = await provider.delete(id);
              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Registro eliminado')),
                );
              }
            },
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
  }
}
`;

    fs.writeFileSync(path.join(dirPath, `${lowerName}_list_screen.dart`), content);
  }

  /**
   * Generar pantalla de formulario MEJORADA con Material 3
   * ✅ Incluye manejo inteligente de relaciones UML con multiplicidades 0..1, 1, 1..1, 1..*, 0..*
   */
  generarPantallaFormulario(dirPath, cls, formConfig, idFieldName = 'id', idFieldMap = {}) {
    const className = cls.name;
    const lowerName = className.toLowerCase();
    const attributes = cls.attributes || [];
    
    console.log(`\n📝 Generando formulario: ${lowerName}_form_screen.dart`);
    console.log(`   🔑 Campo ID: "${idFieldName}"`);
    console.log(`   🔗 Relaciones OUT: ${formConfig?.relationsOut?.length || 0}`);
    
    // ✅ Generar controladores para campos de texto
    const controllers = attributes
      .filter(a => !a.isPrimaryKey && ['String', 'int', 'double'].includes(this.mapTipoDart(a.type)))
      .map(a => `  final _${a.name}Controller = TextEditingController();`)
      .join('\n');
    
    // ✅ Variables para campos especiales (bool, DateTime)
    const specialVars = attributes
      .filter(a => !a.isPrimaryKey)
      .map(a => {
        const dartType = this.mapTipoDart(a.type);
        if (dartType === 'bool') {
          return `  bool _${a.name} = false;`;
        } else if (dartType === 'DateTime') {
          return `  DateTime? _${a.name};`;
        }
        return null;
      })
      .filter(v => v !== null)
      .join('\n');
    
    // ✅ Variables para relaciones OUT (Foreign Keys)
    let relationVars = '';
    let relationImports = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      relationVars = formConfig.relationsOut.map(rel => {
        if (rel.isManyToMany || rel.targetMult === '*') {
          return `  List<int> _selected${this.capitalize(rel.targetClass)}Ids = [];`;
        } else {
          return `  int? _selected${this.capitalize(rel.targetClass)}Id;`;
        }
      }).join('\n');
      
      // Imports de providers relacionados
      relationImports = '\n' + formConfig.relationsOut
        .map(rel => `import '../../providers/${rel.targetClassLower}_provider.dart';`)
        .join('\n');
    }
    
    // ✅ Generar inicialización de controladores
    const initControllers = attributes
      .filter(a => !a.isPrimaryKey && ['String', 'int', 'double'].includes(this.mapTipoDart(a.type)))
      .map(a => `      _${a.name}Controller.text = widget.item?.${a.name}?.toString() ?? '';`)
      .join('\n');
    
    const initSpecialVars = attributes
      .filter(a => !a.isPrimaryKey)
      .map(a => {
        const dartType = this.mapTipoDart(a.type);
        if (dartType === 'bool') {
          return `      _${a.name} = widget.item?.${a.name} ?? false;`;
        } else if (dartType === 'DateTime') {
          return `      _${a.name} = widget.item?.${a.name};`;
        }
        return null;
      })
      .filter(v => v !== null)
      .join('\n');
    
    // ✅ Inicializar relaciones desde el objeto anidado (ej: item.usuario?.ID)
    let initRelations = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      initRelations = formConfig.relationsOut.map(rel => {
        // ✅ Obtener el nombre del campo ID de la clase relacionada
        const relatedIdFieldName = idFieldMap[rel.targetClass] || 'id';
        
        if (rel.isManyToMany || rel.targetMult === '*') {
          return `      _selected${this.capitalize(rel.targetClass)}Ids = widget.item?.${rel.targetClassLower}s?.map((e) => e.${relatedIdFieldName}!).toList() ?? [];`;
        } else {
          // Usar el nombre correcto del campo (ej: item.usuario?.ID, no item.usuario?.id)
          return `      _selected${this.capitalize(rel.targetClass)}Id = widget.item?.${rel.fieldName}?.${relatedIdFieldName};`;
        }
      }).join('\n');
    }
    
    // ✅ Cargar providers de relaciones en initState
    let loadRelatedProviders = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      loadRelatedProviders = '\n    // Cargar datos de relaciones\n' + 
        formConfig.relationsOut.map(rel => 
          `    Future.microtask(() => Provider.of<${rel.targetClass}Provider>(context, listen: false).loadAll());`
        ).join('\n');
    }
    
    // ✅ Generar dispose de controladores
    const disposeControllers = attributes
      .filter(a => !a.isPrimaryKey && ['String', 'int', 'double'].includes(this.mapTipoDart(a.type)))
      .map(a => `    _${a.name}Controller.dispose();`)
      .join('\n');
    
    // ✅ Generar campos del formulario con widgets apropiados
    const formFields = attributes
      .filter(a => !a.isPrimaryKey)
      .map(a => {
        const dartType = this.mapTipoDart(a.type);
        const label = this.capitalize(a.name);
        
        if (dartType === 'String') {
          return `            _buildTextField('${label}', _${a.name}Controller),`;
        } else if (dartType === 'int') {
          return `            _buildNumberField('${label}', _${a.name}Controller, isInt: true),`;
        } else if (dartType === 'double') {
          return `            _buildNumberField('${label}', _${a.name}Controller, isDecimal: true),`;
        } else if (dartType === 'bool') {
          return `            _buildSwitchField('${label}', _${a.name}, (value) => setState(() => _${a.name} = value)),`;
        } else if (dartType === 'DateTime') {
          return `            _buildDateField('${label}', _${a.name}, (value) => setState(() => _${a.name} = value)),`;
        }
        return `            _buildTextField('${label}', _${a.name}Controller),`;
      })
      .join('\n');
    
    // ✅ Generar campos para relaciones OUT (Foreign Keys) con Dropdowns
    let relationFields = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      console.log(`   🎨 Generando ${formConfig.relationsOut.length} campos de relación en formulario`);
      relationFields = '\n            const SizedBox(height: 8),\n            const Divider(),\n            const Text("Relaciones", style: TextStyle(fontWeight: FontWeight.bold)),\n            const SizedBox(height: 8),\n' +
        formConfig.relationsOut.map(rel => {
          console.log(`      → Dropdown para: ${rel.targetClass} (${rel.isRequired ? 'requerido' : 'opcional'})`);
          const capitalizedClass = this.capitalize(rel.targetClass);
          return `            Consumer<${rel.targetClass}Provider>(
              builder: (context, ${rel.targetClassLower}Provider, child) {
                if (${rel.targetClassLower}Provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                
                if (${rel.targetClassLower}Provider.items.isEmpty) {
                  return const Text('No hay ${capitalizedClass}s disponibles');
                }
                
                return DropdownButtonFormField<int>(
                  decoration: InputDecoration(
                    labelText: '${capitalizedClass}',
                    border: const OutlineInputBorder(),
                  ),
                  value: _selected${capitalizedClass}Id,
                  items: ${rel.targetClassLower}Provider.items.map((item) {
                    return DropdownMenuItem<int>(
                      value: item.${idFieldName},
                      child: Text(item.toString()),
                    );
                  }).toList(),
                  onChanged: (value) {
                    setState(() {
                      _selected${capitalizedClass}Id = value;
                    });
                  },
                  validator: (value) {
                    ${rel.isRequired ? `if (value == null) {
                      return 'Debe seleccionar un ${capitalizedClass}';
                    }` : ''}
                    return null;
                  },
                );
              },
            ),`;
        }).join('\n            const SizedBox(height: 12),\n');
    }
    
    // ✅ Generar asignación de valores al crear objeto - CAMPOS NORMALES
    const fieldAssignments = attributes
      .filter(a => !a.isPrimaryKey)
      .map(a => {
        const dartType = this.mapTipoDart(a.type);
        if (dartType === 'int') {
          return `          ${a.name}: int.tryParse(_${a.name}Controller.text) ?? 0,`;
        } else if (dartType === 'double') {
          return `          ${a.name}: double.tryParse(_${a.name}Controller.text) ?? 0.0,`;
        } else if (dartType === 'bool') {
          return `          ${a.name}: _${a.name},`;
        } else if (dartType === 'DateTime') {
          return `          ${a.name}: _${a.name},`;
        } else {
          return `          ${a.name}: _${a.name}Controller.text,`;
        }
      })
      .join('\n');
    
    // ✅ Generar asignación de RELACIONES (como objetos con solo ID: {"usuario": {"ID": 1}})
    let relationAssignments = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      relationAssignments = formConfig.relationsOut.map(rel => {
        const capitalizedClass = this.capitalize(rel.targetClass);
        // ✅ Obtener el nombre del campo ID de la clase relacionada
        const relatedIdFieldName = idFieldMap[rel.targetClass] || 'id';
        
        if (rel.isManyToMany || rel.targetMult === '*') {
          // Lista de objetos: [{"ID": 1}, {"ID": 2}] (usando el nombre correcto del ID)
          return `          ${rel.targetClassLower}s: _selected${capitalizedClass}Ids.map((id) => ${rel.targetClass}(${relatedIdFieldName}: id)).toList(),`;
        } else {
          // Objeto único: {"ID": 1} o null - usar el nombre correcto del campo ID
          const nullCheck = rel.isRequired ? '!' : '?';
          return `          ${rel.fieldName}: _selected${capitalizedClass}Id != null ? ${rel.targetClass}(${relatedIdFieldName}: _selected${capitalizedClass}Id${nullCheck}) : null,`;
        }
      }).join('\n');
    }
    
    // ✅ Construcción final del objeto
    const objectFields = [fieldAssignments, relationAssignments]
      .filter(Boolean)
      .join('\n');
    
    const content = `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/${lowerName}.dart';
import '../../providers/${lowerName}_provider.dart';${relationImports}

class ${className}FormScreen extends StatefulWidget {
  final ${className}? item;

  const ${className}FormScreen({super.key, this.item});

  @override
  State<${className}FormScreen> createState() => _${className}FormScreenState();
}

class _${className}FormScreenState extends State<${className}FormScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  
${controllers}
${relationVars}

  @override
  void initState() {
    super.initState();
    if (widget.item != null) {
${initControllers}${initRelations ? '\n' + initRelations : ''}
    }${loadRelatedProviders}
  }

  @override
  void dispose() {
${disposeControllers}
    super.dispose();
  }

  Future<void> _saveForm() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        final provider = Provider.of<${className}Provider>(context, listen: false);
        
        final item = ${className}(
          ${idFieldName}: widget.item?.${idFieldName},
${objectFields}
        );

        bool success;
        if (widget.item == null) {
          // Crear nuevo
          success = await provider.create(item);
        } else {
          // Actualizar existente
          success = await provider.update(widget.item!.${idFieldName}!, item);
        }

        if (mounted && success) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(widget.item == null
                  ? '${className} creado correctamente'
                  : '${className} actualizado correctamente'),
            ),
          );
        }
      } catch (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: \${error.toString()}')),
          );
        }
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.item == null
            ? 'Crear ${className}'
            : 'Editar ${className}'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: SingleChildScrollView(
                  child: Column(
                    children: [
${formFields}${relationFields}
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _saveForm,
                        child: const Text('Guardar'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildTextField(String label, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        validator: (value) {
          if (value == null || value.isEmpty) {
            return 'Por favor ingrese un valor para $label';
          }
          return null;
        },
      ),
    );
  }

  Widget _buildNumberField(String label, TextEditingController controller,
      {bool isInt = false, bool isDecimal = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        keyboardType: isDecimal
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.number,
        validator: (value) {
          if (value == null || value.isEmpty) {
            return 'Por favor ingrese un valor para $label';
          }
          if (isInt && int.tryParse(value) == null) {
            return 'Ingrese un número entero válido';
          }
          if (isDecimal && double.tryParse(value) == null) {
            return 'Ingrese un número decimal válido';
          }
          return null;
        },
      ),
    );
  }

  Widget _buildSwitchField(String label, bool value, Function(bool) onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: SwitchListTile(
        title: Text(label),
        value: value,
        onChanged: onChanged,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }

  Widget _buildDateField(String label, DateTime? value, Function(DateTime) onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Text(label),
          const Spacer(),
          TextButton(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: value ?? DateTime.now(),
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
              );
              if (picked != null) {
                onChanged(picked);
              }
            },
            child: Text(
              value != null
                  ? '\${value.day}/\${value.month}/\${value.year}'
                  : 'Seleccionar fecha',
            ),
          ),
        ],
      ),
    );
  }
}
`;

    fs.writeFileSync(path.join(dirPath, `${lowerName}_form_screen.dart`), content);
  }

  /**
   * Generar pantalla de detalle CON visualización de relaciones
   */
  generarPantallaDetalle(dirPath, cls, formConfig, idFieldName = 'id') {
    const className = cls.name;
    const lowerName = className.toLowerCase();
    const attributes = cls.attributes || [];
    
    console.log(`\n📋 Generando pantalla detalle: ${lowerName}_detail_screen.dart`);
    console.log(`   🔑 Campo ID: "${idFieldName}"`);
    console.log(`   🔗 Relaciones OUT: ${formConfig?.relationsOut?.length || 0}`);
    
    // Generar items de atributos
    const detailItems = attributes
      .map(a => `            _buildDetailItem('${a.name}', item.${a.name}?.toString() ?? 'No disponible'),`)
      .join('\n');
    
    // Generar sección de relaciones
    let relationCards = '';
    if (formConfig && formConfig.relationsOut && formConfig.relationsOut.length > 0) {
      console.log(`   🎨 Agregando ${formConfig.relationsOut.length} tarjetas de relación`);
      relationCards = formConfig.relationsOut.map(rel => {
        const capitalizedClass = this.capitalize(rel.targetClass);
        if (rel.isManyToMany || rel.targetMult === '*') {
          // Lista de relaciones (@OneToMany)
          return `            // Relación: Lista de ${capitalizedClass}
            if (item.${rel.targetClassLower}s != null && item.${rel.targetClassLower}s!.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${capitalizedClass}s (${rel.cardinality})', 
                           style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const Divider(),
                      ...item.${rel.targetClassLower}s!.map((obj) => 
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Text('• \${obj.toString()}'),
                        )
                      ),
                    ],
                  ),
                ),
              ),`;
        } else {
          // Relación única (@ManyToOne/@OneToOne)
          return `            // Relación: ${capitalizedClass}
            if (item.${rel.targetClassLower} != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${capitalizedClass} (${rel.cardinality})', 
                           style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const Divider(),
                      Text('\${item.${rel.targetClassLower}.toString()}'),
                    ],
                  ),
                ),
              ),`;
        }
      }).join('\n');
    }
    
    const content = `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/${lowerName}.dart';
import '../../providers/${lowerName}_provider.dart';
import '${lowerName}_form_screen.dart';

class ${className}DetailScreen extends StatelessWidget {
  final ${className} item;

  const ${className}DetailScreen({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalles de ${className}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => ${className}FormScreen(item: item),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: () => _confirmDelete(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card principal con atributos
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Información Básica', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const Divider(),
${detailItems}
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Cards de relaciones
${relationCards}
          ],
        ),
      ),
    );
  }

  Widget _buildDetailItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: Text(value),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmar eliminación'),
        content: const Text('¿Estás seguro de que deseas eliminar este elemento?'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
            },
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _deleteItem(context);
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _deleteItem(BuildContext context) async {
    try {
      await Provider.of<${className}Provider>(context, listen: false)
          .delete(item.${idFieldName}!);
      if (context.mounted) {
        Navigator.of(context).pop(); // Volver a la pantalla de lista
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('${className} eliminado correctamente')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al eliminar: \${error.toString()}')),
        );
      }
    }
  }
}
`;

    fs.writeFileSync(path.join(dirPath, `${lowerName}_detail_screen.dart`), content);
  }

  /**
   * Generar dashboard
   */
  generarDashboard(projectPath, classes) {
    const imports = classes.map(cls => 
      `import '${cls.name.toLowerCase()}/${cls.name.toLowerCase()}_list_screen.dart';`
    ).join('\n');
    
    const cards = classes.map((cls, index) => {
      const colors = ['blue', 'green', 'orange', 'purple', 'red', 'teal'];
      const color = colors[index % colors.length];
      return `          DashboardCard(
            title: '${cls.name}',
            icon: Icons.list_alt,
            color: Colors.${color},
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const ${cls.name}ListScreen(),
                ),
              );
            },
          ),`;
    }).join('\n');
    
    const content = `import 'package:flutter/material.dart';
import '../widgets/dashboard_card.dart';
${imports}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        centerTitle: true,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.blue.shade400,
              Colors.blue.shade50,
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            children: [
${cards}
            ],
          ),
        ),
      ),
    );
  }
}
`;

    fs.writeFileSync(path.join(projectPath, "lib/screens/dashboard_screen.dart"), content);
  }

  /**
   * Generar widget DashboardCard
   */
  generarDashboardCard(projectPath) {
    const content = `import 'package:flutter/material.dart';

class DashboardCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const DashboardCard({
    super.key,
    required this.title,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                color.withOpacity(0.7),
                color,
              ],
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 48,
                color: Colors.white,
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`;

    fs.writeFileSync(path.join(projectPath, "lib/widgets/dashboard_card.dart"), content);
  }

  /**
   * Generar widgets de formularios personalizados
   */
  generarFormWidgets(projectPath) {
    // Por ahora, solo creamos un archivo placeholder
    // En el futuro se pueden agregar widgets más específicos
    const content = `// Widgets personalizados para formularios
// Estos widgets se pueden usar para manejar relaciones complejas

import 'package:flutter/material.dart';

// TODO: Agregar widgets personalizados para:
// - DropdownField (para relaciones 1..n)
// - RadioButtonField (para relaciones 1..1)
// - MultiSelectField (para relaciones m..n)
// - EmbeddedFormField (para composición)
`;

    fs.writeFileSync(
      path.join(projectPath, "lib/widgets/form_fields/custom_fields.dart"),
      content
    );
  }
}

export default new FlutterExportController();
