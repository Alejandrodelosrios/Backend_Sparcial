# 🚀 Guía Completa: Generador de Código Flutter desde UML

## 📋 Descripción General

Este sistema genera automáticamente aplicaciones Flutter completas con CRUD funcional a partir de diagramas UML de clases. El código generado incluye:

✅ **Material 3 Design** - UI moderna y responsive
✅ **Widgets Inteligentes** - Adaptados al tipo de dato
✅ **Relaciones UML** - Manejo completo de multiplicidades
✅ **Validaciones** - Automáticas según el tipo
✅ **CRUD Completo** - Create, Read, Update, Delete
✅ **Compatible** - Android, iOS y Web

---

## 🎯 Características Principales

### 1. Tipos de Datos Soportados

| Tipo UML | Widget Flutter | Validación |
|----------|---------------|------------|
| `String` | `TextFormField` | Requerido, longitud |
| `int` | `TextFormField` (numérico) | Entero válido |
| `double` | `TextFormField` (decimal) | Decimal válido |
| `boolean` | `SwitchListTile` | N/A |
| `Date` | `DatePicker` (Card + Calendar) | Rango de fechas |
| `enum` | `DropdownButtonFormField` | Selección obligatoria |

### 2. Relaciones UML

| Multiplicidad | Widget Flutter | Descripción |
|--------------|---------------|-------------|
| `1..1` | `RadioButtonFormField` | Selección única obligatoria |
| `1..*` | `DropdownButtonFormField` | Lista desplegable |
| `*..*` | `MultiSelectDialog` + `Chips` | Selección múltiple |
| Composición | `EmbeddedForm` | Formulario anidado |

---

## 🛠️ Cómo Funciona

### Paso 1: Dibujar Diagrama UML

```
┌─────────────────┐         1..*        ┌─────────────────┐
│    Usuario      │◆────────────────────│    Proyecto     │
├─────────────────┤                     ├─────────────────┤
│ - id: Long      │                     │ - id: Long      │
│ - nombre: String│                     │ - nombre: String│
│ - email: String │                     │ - fechaInicio:  │
│ - activo: bool  │                     │   Date          │
└─────────────────┘                     └─────────────────┘
```

### Paso 2: Generar Código

**Endpoint Backend:**
```javascript
POST /api/crearPagina/exportarFlutter/:salaId
```

**Respuesta:**
```
flutter_app_proyecto.zip
```

### Paso 3: Estructura Generada

```
flutter_app/
├── lib/
│   ├── main.dart                    # Entry point + Providers
│   │
│   ├── models/                      # Modelos de datos
│   │   ├── usuario.dart
│   │   └── proyecto.dart
│   │
│   ├── services/                    # API REST
│   │   ├── api_config.dart         # URL base configurable
│   │   ├── usuario_service.dart
│   │   └── proyecto_service.dart
│   │
│   ├── providers/                   # Gestión de estado
│   │   ├── usuario_provider.dart
│   │   └── proyecto_provider.dart
│   │
│   ├── screens/                     # Pantallas CRUD
│   │   ├── dashboard_screen.dart   # Dashboard principal
│   │   ├── usuario/
│   │   │   ├── usuario_list_screen.dart    # Lista con Cards
│   │   │   ├── usuario_form_screen.dart    # Formulario CRUD
│   │   │   └── usuario_detail_screen.dart  # Vista detalle
│   │   └── proyecto/
│   │       ├── proyecto_list_screen.dart
│   │       ├── proyecto_form_screen.dart
│   │       └── proyecto_detail_screen.dart
│   │
│   └── widgets/                     # Widgets reutilizables
│       ├── dashboard_card.dart     # Tarjetas del dashboard
│       └── form_fields/
│           └── custom_fields.dart  # Campos personalizados
│
└── pubspec.yaml                     # Dependencias
```

---

## 📝 Código Generado - Ejemplos

### 1. Modelo (models/usuario.dart)

```dart
import 'dart:convert';

class Usuario {
  final int? id;
  final String nombre;
  final String email;
  final bool activo;

  Usuario({
    this.id,
    required this.nombre,
    required this.email,
    required this.activo,
  });

  // Serialización JSON
  Map<String, dynamic> toJson() => {
    'id': id,
    'nombre': nombre,
    'email': email,
    'activo': activo,
  };

  // Deserialización JSON
  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
    id: json['id'] as int?,
    nombre: json['nombre'] as String,
    email: json['email'] as String,
    activo: json['activo'] as bool,
  );
}
```

### 2. Servicio API (services/usuario_service.dart)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/usuario.dart';
import 'api_config.dart';

class UsuarioService {
  static const String endpoint = '/usuarios';
  
  /// GET /usuarios - Listar todos
  static Future<List<Usuario>> getAll() async {
    final response = await ApiConfig.get(endpoint);
    ApiConfig.handleError(response);
    
    final List<dynamic> jsonList = jsonDecode(response.body);
    return jsonList.map((json) => Usuario.fromJson(json)).toList();
  }
  
  /// POST /usuarios - Crear nuevo
  static Future<Usuario> create(Usuario item) async {
    final response = await ApiConfig.post(endpoint, item.toJson());
    ApiConfig.handleError(response);
    return Usuario.fromJson(jsonDecode(response.body));
  }
  
  /// PUT /usuarios/{id} - Actualizar
  static Future<Usuario> update(int id, Usuario item) async {
    final response = await ApiConfig.put('$endpoint/$id', item.toJson());
    ApiConfig.handleError(response);
    return Usuario.fromJson(jsonDecode(response.body));
  }
  
  /// DELETE /usuarios/{id} - Eliminar
  static Future<void> delete(int id) async {
    final response = await ApiConfig.delete('$endpoint/$id');
    ApiConfig.handleError(response);
  }
}
```

### 3. Formulario con Validaciones (screens/usuario/usuario_form_screen.dart)

```dart
class UsuarioFormScreen extends StatefulWidget {
  final Usuario? item;
  const UsuarioFormScreen({super.key, this.item});
  
  @override
  State<UsuarioFormScreen> createState() => _UsuarioFormScreenState();
}

class _UsuarioFormScreenState extends State<UsuarioFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nombreController = TextEditingController();
  final _emailController = TextEditingController();
  bool _activo = false;
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.item == null ? 'Crear Usuario' : 'Editar Usuario'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: EdgeInsets.all(16),
          children: [
            // Campo de texto con validación
            TextFormField(
              controller: _nombreController,
              decoration: InputDecoration(
                labelText: 'Nombre',
                border: OutlineInputBorder(),
                filled: true,
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '⚠️ Nombre es requerido';
                }
                return null;
              },
            ),
            
            SizedBox(height: 16),
            
            // Campo email con validación
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
                filled: true,
                prefixIcon: Icon(Icons.email),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '⚠️ Email es requerido';
                }
                if (!value.contains('@')) {
                  return '⚠️ Email inválido';
                }
                return null;
              },
            ),
            
            SizedBox(height: 16),
            
            // Switch para booleano
            Card(
              child: SwitchListTile(
                title: Text('Activo'),
                value: _activo,
                onChanged: (value) => setState(() => _activo = value),
                secondary: Icon(
                  _activo ? Icons.check_circle : Icons.circle_outlined,
                  color: _activo ? Colors.green : Colors.grey,
                ),
              ),
            ),
            
            SizedBox(height: 24),
            
            // Botones de acción
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text('Cancelar'),
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: FilledButton(
                    onPressed: _saveForm,
                    child: Text('Guardar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 🔗 Manejo de Relaciones

### Relación 1..* (Uno a Muchos)

**Ejemplo:** Un Usuario tiene muchos Proyectos

```dart
/// En ProyectoFormScreen
Widget _buildUsuarioDropdown() {
  return DropdownButtonFormField<int>(
    decoration: InputDecoration(
      labelText: 'Usuario',
      border: OutlineInputBorder(),
      filled: true,
      prefixIcon: Icon(Icons.person),
    ),
    value: _selectedUsuarioId,
    items: _usuarios.map((usuario) {
      return DropdownMenuItem(
        value: usuario.id,
        child: Text(usuario.nombre),
      );
    }).toList(),
    onChanged: (value) {
      setState(() => _selectedUsuarioId = value);
    },
    validator: (value) {
      if (value == null) return '⚠️ Seleccione un usuario';
      return null;
    },
  );
}
```

### Relación 1..1 (Uno a Uno)

**Ejemplo:** Un Usuario tiene un Perfil

```dart
/// RadioButton para selección única
Widget _buildPerfilRadio() {
  return Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.all(16),
          child: Text('Perfil', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ),
        ..._perfiles.map((perfil) => RadioListTile<int>(
          title: Text(perfil.nombre),
          value: perfil.id!,
          groupValue: _selectedPerfilId,
          onChanged: (value) => setState(() => _selectedPerfilId = value),
        )),
      ],
    ),
  );
}
```

### Relación *..* (Muchos a Muchos)

**Ejemplo:** Estudiantes en múltiples Cursos

```dart
/// Multi-select con chips
Widget _buildCursosMultiSelect() {
  return Card(
    child: Column(
      children: [
        ListTile(
          title: Text('Cursos'),
          trailing: IconButton(
            icon: Icon(Icons.add),
            onPressed: _mostrarDialogoCursos,
          ),
        ),
        Wrap(
          spacing: 8,
          children: _cursosSeleccionados.map((curso) {
            return Chip(
              label: Text(curso.nombre),
              onDeleted: () {
                setState(() {
                  _cursosSeleccionados.remove(curso);
                });
              },
            );
          }).toList(),
        ),
      ],
    ),
  );
}
```

---

## ⚙️ Configuración

### 1. Configurar URL del Backend

Editar `lib/services/api_config.dart`:

```dart
class ApiConfig {
  // ⚠️ MODIFICAR SEGÚN TU ENTORNO
  
  // Android Emulator
  static const String baseUrl = 'http://10.0.2.2:8080/api';
  
  // iOS Simulator
  // static const String baseUrl = 'http://localhost:8080/api';
  
  // Dispositivo físico (cambiar IP)
  // static const String baseUrl = 'http://192.168.1.100:8080/api';
  
  // Producción
  // static const String baseUrl = 'https://api.miapp.com/api';
}
```

### 2. Instalar Dependencias

```bash
cd flutter_app_proyecto
flutter pub get
```

### 3. Ejecutar la Aplicación

```bash
# Android/iOS
flutter run

# Web
flutter run -d chrome

# Ver dispositivos disponibles
flutter devices
```

---

## 📱 Compatibilidad de Plataformas

### ✅ Android
- **Compilación:** APK/AAB nativo
- **Rendimiento:** Nativo
- **APIs:** Acceso completo

### ✅ iOS
- **Compilación:** IPA nativo
- **Rendimiento:** Nativo
- **Requisitos:** macOS + Xcode

### ✅ Web
- **Compilación:** JavaScript/WebAssembly
- **Navegadores:** Chrome, Firefox, Safari, Edge
- **Limitaciones:** Algunos plugins nativos no disponibles

---

## 🎨 Material 3 Design

El código generado usa Material 3 (Material You) con:

- ✅ Filled Buttons
- ✅ Outlined Buttons
- ✅ Cards elevadas
- ✅ Color scheme adaptativo
- ✅ Typography mejorada
- ✅ Iconografía moderna

---

## 🧪 Testing

### Probar en Android Emulator:

```bash
# Crear emulador
flutter emulators --create

# Listar emuladores
flutter emulators

# Ejecutar
flutter run
```

### Probar en Web:

```bash
# Desarrollo
flutter run -d chrome

# Build de producción
flutter build web
```

---

## 🚀 Despliegue

### Android (Play Store):

```bash
flutter build appbundle
# Subir: build/app/outputs/bundle/release/app-release.aab
```

### iOS (App Store):

```bash
flutter build ipa
# Subir con Xcode Organizer
```

### Web (Hosting):

```bash
flutter build web
# Subir carpeta: build/web/ a Firebase Hosting, Netlify, etc.
```

---

## 📚 Documentación Adicional

- [Flutter Docs](https://flutter.dev/docs)
- [Material 3](https://m3.material.io/)
- [Provider Package](https://pub.dev/packages/provider)
- [HTTP Package](https://pub.dev/packages/http)

---

## 🐛 Troubleshooting

### Error: "No se puede conectar al backend"

**Solución:**
1. Verificar que el backend esté corriendo
2. Revisar la URL en `api_config.dart`
3. Para Android Emulator usar `10.0.2.2` en lugar de `localhost`

### Error: "Validation failed"

**Solución:**
1. Revisar que los campos requeridos estén completos
2. Verificar formato de email si aplica
3. Revisar tipos de datos (int vs String)

### Error: "Provider not found"

**Solución:**
1. Verificar que el Provider esté registrado en `main.dart`
2. Usar `Provider.of<T>(context, listen: false)` para acceso sin UI

---

**✅ Proyecto generado con éxito. ¡A codear!** 🚀
