# 📱 Generación de Frontend Flutter desde Diagrama UML

## Índice
1. [Introducción](#introducción)
2. [Flujo General del Proceso](#flujo-general-del-proceso)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Ejemplo Práctico](#ejemplo-práctico)
5. [Estructura del Proyecto Generado](#estructura-del-proyecto-generado)
6. [Manejo de Relaciones en Formularios](#manejo-de-relaciones-en-formularios)
7. [Configuración y Uso](#configuración-y-uso)

---

## Introducción

Este sistema permite generar automáticamente una aplicación completa de Flutter a partir de un diagrama UML de clases. La aplicación generada incluye:

- **Modelos de datos** con serialización JSON
- **Servicios API** para comunicación con backend Spring Boot
- **Gestión de estado** con Provider
- **Pantallas CRUD** completas (Crear, Leer, Actualizar, Eliminar)
- **Dashboard** con navegación entre entidades
- **Formularios inteligentes** que se adaptan según las relaciones entre clases

---

## Flujo General del Proceso

```
┌─────────────────────────────────────────────────────────────┐
│  1. Usuario dibuja diagrama UML en la pizarra visual       │
│     - Define clases con atributos y métodos                │
│     - Establece relaciones entre clases                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Usuario hace clic en "Generar en Flutter"              │
│     - Frontend (pizarra.js) envía ID de la sala            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Backend obtiene el diagrama desde la base de datos     │
│     - Lee el XML/JSON del diagrama UML                     │
│     - Extrae clases, atributos y relaciones                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Backend analiza relaciones para formularios dinámicos  │
│     - 1..1 → RadioButton                                   │
│     - 1..n → Dropdown                                      │
│     - m..n → Multi-select                                  │
│     - Composición → Formulario embebido                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Backend genera código Dart/Flutter                     │
│     - Modelos (models/)                                    │
│     - Servicios API (services/)                            │
│     - Providers (providers/)                               │
│     - Pantallas CRUD (screens/)                            │
│     - Dashboard                                            │
│     - Widgets personalizados                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Backend empaqueta todo en un archivo ZIP               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Usuario descarga el proyecto Flutter completo          │
│     - Descomprime el ZIP                                   │
│     - Ejecuta flutter pub get                              │
│     - Ejecuta flutter run                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes del Sistema

### 1. Frontend (pizarra.js)

**Ubicación:** `PrimerParcialFrontEnd/src/public/js/pizarra.js`

**Función principal:**
```javascript
static async exportFlutter() {
  // 1. Obtiene el ID de la sala actual
  const salaId = obtenerIdSala();
  
  // 2. Hace petición POST al backend
  const response = await fetch(`/api/crearPagina/exportarFlutter/${salaId}`);
  
  // 3. Descarga el archivo ZIP generado
  descargarZip(response);
}
```

### 2. Backend (flutterExport.controller.js)

**Ubicación:** `PrimerParcialBackend/src/controllers/flutterExport.controller.js`

**Método principal:**
```javascript
exportarFlutterDesdeSala(req, res) {
  // 1. Obtener diagrama de la base de datos
  // 2. Parsear XML/JSON
  // 3. Analizar relaciones
  // 4. Generar código Flutter
  // 5. Crear archivo ZIP
  // 6. Enviar al cliente
}
```

---

## Ejemplo Práctico

### Diagrama UML de Entrada

Supongamos que tenemos el siguiente diagrama UML:

```
┌─────────────────┐              ┌─────────────────┐
│    Usuario      │              │    Proyecto     │
├─────────────────┤     1    *   ├─────────────────┤
│ - id: Long      │──────────────│ - id: Long      │
│ - nombre: String│              │ - nombre: String│
│ - email: String │              │ - usuarioId: Long│
├─────────────────┤              ├─────────────────┤
│ + crear()       │              │ + crear()       │
│ + actualizar()  │              │ + actualizar()  │
└─────────────────┘              └─────────────────┘
```

**Relación:** Un Usuario tiene muchos Proyectos (1..*)

### Código Flutter Generado

#### 1. Modelo Usuario (`lib/models/usuario.dart`)

```dart
import 'dart:convert';

class Usuario {
  final int? id;
  final String nombre;
  final String email;

  Usuario({
    this.id,
    required this.nombre,
    required this.email,
  });

  // Convertir objeto a JSON
  Map<String, dynamic> toJson() => {
    'id': id,
    'nombre': nombre,
    'email': email,
  };

  // Crear objeto desde JSON
  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
    id: json['id'] as int?,
    nombre: json['nombre'] as String,
    email: json['email'] as String,
  );

  String toJsonString() => jsonEncode(toJson());

  static Usuario fromJsonString(String str) => 
      Usuario.fromJson(jsonDecode(str));

  @override
  String toString() {
    return 'Usuario(id: $id, nombre: $nombre, email: $email)';
  }
}
```

#### 2. Servicio API (`lib/services/usuario_service.dart`)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/usuario.dart';
import 'api_config.dart';

class UsuarioService {
  // ⚠️ Este endpoint debe coincidir con tu backend Spring Boot
  // Por ejemplo: @RequestMapping("/api/usuarios")
  static const String endpoint = '/usuarios';
  
  /// Obtener todos los usuarios
  static Future<List<Usuario>> getAll() async {
    try {
      final response = await ApiConfig.get(endpoint);
      ApiConfig.handleError(response);
      
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => Usuario.fromJson(json)).toList();
    } catch (e) {
      print('❌ Error obteniendo usuarios: $e');
      rethrow;
    }
  }
  
  /// Obtener un usuario por ID
  static Future<Usuario> getById(int id) async {
    try {
      final response = await ApiConfig.get('$endpoint/$id');
      ApiConfig.handleError(response);
      
      return Usuario.fromJson(jsonDecode(response.body));
    } catch (e) {
      print('❌ Error obteniendo usuario $id: $e');
      rethrow;
    }
  }
  
  /// Crear un nuevo usuario
  static Future<Usuario> create(Usuario item) async {
    try {
      final response = await ApiConfig.post(endpoint, item.toJson());
      ApiConfig.handleError(response);
      
      return Usuario.fromJson(jsonDecode(response.body));
    } catch (e) {
      print('❌ Error creando usuario: $e');
      rethrow;
    }
  }
  
  /// Actualizar un usuario existente
  static Future<Usuario> update(int id, Usuario item) async {
    try {
      final response = await ApiConfig.put('$endpoint/$id', item.toJson());
      ApiConfig.handleError(response);
      
      return Usuario.fromJson(jsonDecode(response.body));
    } catch (e) {
      print('❌ Error actualizando usuario $id: $e');
      rethrow;
    }
  }
  
  /// Eliminar un usuario
  static Future<void> delete(int id) async {
    try {
      final response = await ApiConfig.delete('$endpoint/$id');
      ApiConfig.handleError(response);
    } catch (e) {
      print('❌ Error eliminando usuario $id: $e');
      rethrow;
    }
  }
}
```

#### 3. Provider (`lib/providers/usuario_provider.dart`)

```dart
import 'package:flutter/foundation.dart';
import '../models/usuario.dart';
import '../services/usuario_service.dart';

class UsuarioProvider with ChangeNotifier {
  List<Usuario> _items = [];
  bool _isLoading = false;
  String? _error;
  
  List<Usuario> get items => _items;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  /// Cargar todos los usuarios
  Future<void> loadAll() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      _items = await UsuarioService.getAll();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }
  
  /// Crear un nuevo usuario
  Future<bool> create(Usuario item) async {
    try {
      final created = await UsuarioService.create(item);
      _items.add(created);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
  
  /// Actualizar un usuario
  Future<bool> update(int id, Usuario item) async {
    try {
      final updated = await UsuarioService.update(id, item);
      final index = _items.indexWhere((i) => i.id == id);
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
  
  /// Eliminar un usuario
  Future<bool> delete(int id) async {
    try {
      await UsuarioService.delete(id);
      _items.removeWhere((item) => item.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
```

#### 4. Pantalla de Lista (`lib/screens/usuario/usuario_list_screen.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/usuario.dart';
import '../../providers/usuario_provider.dart';
import 'usuario_form_screen.dart';
import 'usuario_detail_screen.dart';

class UsuarioListScreen extends StatefulWidget {
  const UsuarioListScreen({super.key});

  @override
  State<UsuarioListScreen> createState() => _UsuarioListScreenState();
}

class _UsuarioListScreenState extends State<UsuarioListScreen> {
  @override
  void initState() {
    super.initState();
    // Cargar datos al iniciar
    Future.microtask(() => 
      Provider.of<UsuarioProvider>(context, listen: false).loadAll()
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Usuarios'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              Provider.of<UsuarioProvider>(context, listen: false).loadAll();
            },
          ),
        ],
      ),
      body: Consumer<UsuarioProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          
          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Error: ${provider.error}'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.loadAll(),
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }
          
          if (provider.items.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inbox, size: 48, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No hay usuarios'),
                ],
              ),
            );
          }
          
          // Lista de usuarios
          return ListView.builder(
            itemCount: provider.items.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final item = provider.items[index];
              return Card(
                child: ListTile(
                  title: Text(item.nombre),
                  subtitle: Text('Email: ${item.email}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit, color: Colors.blue),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => UsuarioFormScreen(item: item),
                            ),
                          );
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red),
                        onPressed: () => _confirmDelete(context, provider, item.id!),
                      ),
                    ],
                  ),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => UsuarioDetailScreen(item: item),
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
              builder: (context) => const UsuarioFormScreen(),
            ),
          );
        },
      ),
    );
  }
  
  void _confirmDelete(BuildContext context, UsuarioProvider provider, int id) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar eliminación'),
        content: const Text('¿Está seguro de eliminar este usuario?'),
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
                  const SnackBar(content: Text('Usuario eliminado')),
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
```

#### 5. Dashboard (`lib/screens/dashboard_screen.dart`)

```dart
import 'package:flutter/material.dart';
import '../widgets/dashboard_card.dart';
import 'usuario/usuario_list_screen.dart';
import 'proyecto/proyecto_list_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        centerTitle: true,
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
              DashboardCard(
                title: 'Usuarios',
                icon: Icons.person,
                color: Colors.blue,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const UsuarioListScreen(),
                    ),
                  );
                },
              ),
              DashboardCard(
                title: 'Proyectos',
                icon: Icons.folder,
                color: Colors.green,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const ProyectoListScreen(),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## Estructura del Proyecto Generado

```
flutter_app/
├── lib/
│   ├── main.dart                    # Punto de entrada de la app
│   │
│   ├── models/                      # Modelos de datos
│   │   ├── usuario.dart
│   │   └── proyecto.dart
│   │
│   ├── services/                    # Servicios para comunicación con API
│   │   ├── api_config.dart         # Configuración base (URL del backend)
│   │   ├── usuario_service.dart
│   │   └── proyecto_service.dart
│   │
│   ├── providers/                   # Gestión de estado con Provider
│   │   ├── usuario_provider.dart
│   │   └── proyecto_provider.dart
│   │
│   ├── screens/                     # Pantallas de la aplicación
│   │   ├── dashboard_screen.dart   # Dashboard principal
│   │   ├── usuario/
│   │   │   ├── usuario_list_screen.dart    # Listado de usuarios
│   │   │   ├── usuario_form_screen.dart    # Crear/Editar usuario
│   │   │   └── usuario_detail_screen.dart  # Ver detalles de usuario
│   │   └── proyecto/
│   │       ├── proyecto_list_screen.dart
│   │       ├── proyecto_form_screen.dart
│   │       └── proyecto_detail_screen.dart
│   │
│   └── widgets/                     # Widgets reutilizables
│       ├── dashboard_card.dart     # Tarjeta para el dashboard
│       └── form_fields/
│           └── custom_fields.dart  # Campos personalizados
│
└── pubspec.yaml                     # Dependencias del proyecto
```

---

## Manejo de Relaciones en Formularios

El sistema genera formularios inteligentes basados en el tipo de relación entre clases:

### 1. Relación 1..1 (Uno a Uno)

**Ejemplo:** Un Usuario tiene un Perfil

**Campo generado:** RadioButton o Selector único

```dart
// En el formulario de Usuario
Widget _buildPerfilSelector() {
  return Column(
    children: [
      const Text('Perfil'),
      ...perfiles.map((perfil) => RadioListTile(
        title: Text(perfil.nombre),
        value: perfil.id,
        groupValue: _selectedPerfilId,
        onChanged: (value) {
          setState(() => _selectedPerfilId = value);
        },
      )),
    ],
  );
}
```

### 2. Relación 1..* (Uno a Muchos)

**Ejemplo:** Un Usuario tiene muchos Proyectos

**Campo generado:** Dropdown (Select)

```dart
// En el formulario de Proyecto
Widget _buildUsuarioDropdown() {
  return DropdownButtonFormField<int>(
    decoration: const InputDecoration(
      labelText: 'Usuario',
      border: OutlineInputBorder(),
    ),
    value: _selectedUsuarioId,
    items: usuarios.map((usuario) {
      return DropdownMenuItem(
        value: usuario.id,
        child: Text(usuario.nombre),
      );
    }).toList(),
    onChanged: (value) {
      setState(() => _selectedUsuarioId = value);
    },
    validator: (value) {
      if (value == null) {
        return 'Por favor seleccione un usuario';
      }
      return null;
    },
  );
}
```

### 3. Relación *..* (Muchos a Muchos)

**Ejemplo:** Estudiantes pueden estar en muchos Cursos

**Campo generado:** Multi-select con chips

```dart
// En el formulario de Estudiante
Widget _buildCursosMultiSelect() {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('Cursos'),
      Wrap(
        spacing: 8.0,
        children: _selectedCursos.map((curso) {
          return Chip(
            label: Text(curso.nombre),
            onDeleted: () {
              setState(() {
                _selectedCursos.remove(curso);
              });
            },
          );
        }).toList(),
      ),
      ElevatedButton(
        onPressed: () => _showCursosDialog(),
        child: const Text('Agregar Curso'),
      ),
    ],
  );
}
```

### 4. Composición

**Ejemplo:** Un Pedido está compuesto por Items

**Campo generado:** Formulario embebido (inline)

```dart
// En el formulario de Pedido
Widget _buildItemsEmbeddedForm() {
  return Column(
    children: [
      const Text('Items del Pedido'),
      ..._items.map((item) => Card(
        child: ListTile(
          title: Text(item.nombre),
          subtitle: Text('Cantidad: ${item.cantidad}'),
          trailing: IconButton(
            icon: const Icon(Icons.delete),
            onPressed: () {
              setState(() {
                _items.remove(item);
              });
            },
          ),
        ),
      )),
      ElevatedButton(
        onPressed: () => _addNewItem(),
        child: const Text('Agregar Item'),
      ),
    ],
  );
}
```

### 5. Agregación

**Ejemplo:** Un Departamento tiene Empleados (independientes)

**Campo generado:** Referencia a entidad existente

```dart
// En el formulario de Departamento
Widget _buildEmpleadosReferenceSelect() {
  return Column(
    children: [
      const Text('Empleados'),
      MultiSelectChip(
        empleados,
        onSelectionChanged: (selectedList) {
          setState(() {
            _selectedEmpleados = selectedList;
          });
        },
      ),
    ],
  );
}
```

---

## Configuración y Uso

### 1. Descargar el Proyecto

1. Hacer clic en el botón "Generar en Flutter" en la pizarra UML
2. Descargar el archivo ZIP generado
3. Descomprimir en tu carpeta de proyectos

### 2. Configurar el Backend

Editar `lib/services/api_config.dart`:

```dart
class ApiConfig {
  // ⚠️ IMPORTANTE: Cambiar esta URL por la de tu backend
  
  // Para Android Emulator:
  static const String baseUrl = 'http://10.0.2.2:8080/api';
  
  // Para iOS Simulator:
  // static const String baseUrl = 'http://localhost:8080/api';
  
  // Para dispositivo físico (cambiar IP):
  // static const String baseUrl = 'http://192.168.1.100:8080/api';
  
  // Para producción:
  // static const String baseUrl = 'https://tu-dominio.com/api';
}
```

### 3. Instalar Dependencias

```bash
cd flutter_app
flutter pub get
```

### 4. Ejecutar la Aplicación

```bash
# En emulador/simulador
flutter run

# En dispositivo físico
flutter run -d <device-id>

# Ver dispositivos disponibles
flutter devices
```

### 5. Verificar Conexión con Backend

1. Asegúrate de que tu backend Spring Boot esté ejecutándose
2. Verifica que la URL en `api_config.dart` sea correcta
3. Prueba el endpoint desde el navegador o Postman
4. Revisa los logs de la aplicación Flutter para errores de conexión

---

## Ventajas del Sistema

✅ **Generación automática completa:** No necesitas escribir código manualmente

✅ **Consistencia:** Todas las pantallas siguen el mismo patrón

✅ **Formularios inteligentes:** Se adaptan automáticamente al tipo de relación

✅ **Gestión de estado:** Provider configurado y listo para usar

✅ **Comunicación con API:** Servicios ya configurados para el backend

✅ **Dashboard profesional:** Interfaz moderna con navegación intuitiva

✅ **Manejo de errores:** Incluye validación y mensajes de error

✅ **Responsive:** Se adapta a diferentes tamaños de pantalla

---

## Limitaciones Conocidas

⚠️ **Login/Autenticación:** No se genera automáticamente (cada proyecto tiene requisitos diferentes)

⚠️ **Relaciones complejas:** Las relaciones muy complejas requieren ajustes manuales

⚠️ **Validaciones personalizadas:** Solo incluye validaciones básicas

⚠️ **Estilos personalizados:** Usa tema por defecto de Material Design

---

## Próximos Pasos

Una vez generado el proyecto, puedes:

1. **Personalizar estilos:** Modificar colores, fuentes y temas
2. **Agregar validaciones:** Implementar reglas de negocio específicas
3. **Implementar autenticación:** Agregar login y manejo de tokens
4. **Mejorar UX:** Añadir animaciones y transiciones
5. **Agregar más funcionalidades:** Búsqueda, filtros, paginación, etc.
6. **Optimizar rendimiento:** Implementar caché y lazy loading
7. **Agregar tests:** Crear pruebas unitarias e integración

---

## Soporte y Documentación

Para más información sobre Flutter:
- [Documentación oficial de Flutter](https://flutter.dev/docs)
- [Guía de Provider](https://pub.dev/packages/provider)
- [HTTP package](https://pub.dev/packages/http)

---

**Generado automáticamente por el Sistema de Generación de Código UML**
