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
- **Kill Switch (Bloqueo Remoto):** Mecanismo de seguridad que consulta un archivo JSON remoto (Gist) al inicio. Permite desactivar la aplicación globalmente instantáneamente en caso de robo de código o abuso.
    - **Modo Fail-Open:** Si no hay internet, respeta el último estado conocido.
    - **Sticky Lock:** Una vez bloqueada, la app permanece inutilizable localmente hasta nueva orden.
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

## 📝 Notas de Versión (v1.1.1) - Fixes & Seguridad
- **Sec (Kill Switch):** Documentación e implementación de sistema de apagado remoto vía Gist.
- **Fix (Excel):** Solución a error "Call to function 'ExpoSharing.shareAsync' has been rejected" bloqueando múltiples clics simultáneos en el botón de descarga.
- **UI:** Mejoras en feedback visual durante descargas.

## 📝 Notas de Versión (v1.1.0) - Actualización de Lógica de Fechas
- **Feat (Fechas):** Implementación de **"Sticky Date"** (Fecha Persistente). Los lotes mantienen la fecha del último lote ingresado hasta que la secuencia llega a 999.
- **Feat (Fechas):** **"Global Seed Date"**. Supervisores pueden fijar una fecha inicial global desde Configuración o Ingreso Manual.
- **Feat (Fechas):** **Bloqueo por Rol**. El campo Fecha ahora es de solo lectura para usuarios no privilegiados.
- **Feat (Fechas):** **Manual Override**. Al fijar una fecha manualmente y presionar "Fijar Global", esta se convierte en la nueva semilla para todos los grados nuevos.
- **Feat (Export):** Botón para exportar base de datos a Excel directamente desde la App.
- **UI:** Indicadores visuales de origen de fecha (Lote Activo, Nuevo Ciclo, Global, Manual).

## 📝 Notas de Versión (v1.0.3)
- **Feat:** Nuevo selector de usuarios ("Modal") independiente del tema del sistema.
- **Fix:** Corrección de visibilidad en escáner y login (textos negros sobre fondo oscuro corregidos).
- **Sec:** Activación de Hermes para ofuscación de código.
