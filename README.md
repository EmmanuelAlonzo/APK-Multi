# Control de MP - Multi Steel (Mobile App)

Aplicación móvil desarrollada en **React Native (Expo)** para el control, escaneo y gestión de materia prima (acero) en planta.

## 🚀 Características Principales

### 1. 📷 Escáner Inteligente (Smart Scanner)
- **Detección Automática:** Interpreta etiquetas complejas de proveedores (Benxi, Jiujiang, etc.).
- **Extracción de Datos:** Identifica automáticamente:
    - **SAE** (Grado del acero)
    - **Peso** (Kg)
    - **Colada** (Heat Number) con heurística avanzada.
    - **Rollo/Bundle** (Coil) verificando formato numérico estricto.
- **Validación en Tiempo Real:** Ventana modal oscura para confirmar datos antes de guardar.

### 2. 🌑 Industrial Dark Theme
- Diseño profesional de alto contraste optimizado para entornos industriales y baja luminosidad.
- **Paleta:** Fondo Negro (`#121212`), Tarjetas Gris Oscuro (`#1E1E1E`), Acentos Rojos (`#D32F2F`).
- **Accesibilidad:** Textos blancos y controles de alta visibilidad.

### 3. 🔒 Seguridad y Ofuscación
- **Protección de Código:** Motor **Hermes** habilitado con compilación de bytecode.
- **Anti-Ingeniería Inversa:** El código fuente (`index.android.bundle`) es ilegible en el APK de producción.
- **Gestión de Sesiones:** Login con PIN y lista de usuarios sincronizada.

### 4. ☁️ Sincronización Cloud
- Conectividad directa con **Google Sheets** a través de Google Apps Script.
- Generación automática de **Lotes (Batch IDs)** secuenciales.
- Historial local persistente para zonas sin conexión.

---

## 🛠️ Tecnologías

- **Framework:** React Native / Expo SDK 52
- **Lenguaje:** JavaScript (ES6+)
- **UI:** StyleSheet Nativa + React Native Modal
- **Motor JS:** Hermes (Bytecode optimization)
- **Cámara:** `expo-camera`
- **Backend:** Google Apps Script (Web App)

---

## 📦 Instalación y Desarrollo

1. **Clonar repositorio:**
   ```bash
   git clone <URL_DEL_REPO>
   cd APK
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Ejecutar en desarrollo:**
   ```bash
   npx expo start
   ```

---

## 🔨 Generar APK de Producción (Seguro)

Para generar el archivo instalable con la protección Hermes activada:

1. **Build con EAS:**
   ```bash
   eas build --platform android --profile production
   ```

2. **Verificar Seguridad (Opcional):**
   - Abrir el APK generado como ZIP.
   - Inspeccionar `assets/index.android.bundle`.
   - Confirmar que el contenido es binario (Hermes Bytecode) y no texto plano.

---

## 📝 Notas de Versión (v1.0.3)
- **Feat:** Nuevo selector de usuarios ("Modal") independiente del tema del sistema.
- **Fix:** Corrección de visibilidad en escáner y login (textos negros sobre fondo oscuro corregidos).
- **Sec:** Activación de Hermes para ofuscación de código.
