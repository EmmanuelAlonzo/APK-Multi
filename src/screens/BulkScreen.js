import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import Papa from 'papaparse';
import { fetchBulkData, getNextBatchSequence, fetchExternalBulkData } from '../utils/api';

export default function BulkScreen({ navigation }) {
    
    const [filterGrade, setFilterGrade] = useState(''); // NUEVO: Filtrar por Grado
    const [externalUrl, setExternalUrl] = useState(''); // NUEVO: Estado de URL externa
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleGenerate = async (isExternal = false) => {
        // Validation of sheetUrl is no longer needed as we use the stored one.
        
        setLoading(true);
        setStatus('Consultando datos...');

        try {
            // 1. Fetch Data
            let rawRows;
            if (isExternal) {
                if (!externalUrl) {
                     throw new Error("Por favor ingresa una URL válida.");
                }
                rawRows = await fetchExternalBulkData(externalUrl);
            } else {
                 // Classic DB Fetch
                 rawRows = await fetchBulkData();
            }
            // The script now returns [ { Grade: "...", ... }, ... ]
            // const rawRows = await fetchBulkData(); // OLD
            
            if (!rawRows || rawRows.length === 0) {
                 throw new Error("La hoja de datos está vacía.");
            }

            // FILTER: Remove invalid rows (Headers, Empty Weights)
            let rows = rawRows.filter(r => {
                const w = parseFloat(r.Weight);
                // Must have valid weight, and Batch must not be header
                return w > 0 && r.Batch && r.Batch !== 'Batch' && r.Batch !== 'Lote';
            });
            
            if (rows.length === 0) {
                throw new Error("No se encontraron registros válidos (con Peso > 0).");
            }
            
            // rows is already an array of objects, no need for Papa Parse or header mapping if script does it cleanly.
            // However, script does simple clean.
            // Adjust logic below to use 'rows' directly.

            // LÓGICA DE FILTRADO
            // let rows = parsed.data; // Esta línea es redundante ya que 'rows' es la data analizada.

            // NUEVO: Restricciones (1. Filtro Requerido si tamaño >= 10, 2. Excepción para lotes pequeños)
            if (!filterGrade) {
                if (rows.length >= 10) {
                    Alert.alert(
                        "Filtro Requerido", 
                        `El archivo contiene ${rows.length} registros. Para evitar errores en lotes grandes, por favor selecciona un filtro de Grado.`
                    );
                    setLoading(false);
                    setStatus('');
                    return;
                }
                // If < 10, strictly implicitly allowed (Test Mode)
            }
            
            if (filterGrade.trim()) {
                const target = parseFloat(filterGrade).toFixed(2); // Normalize user input
                rows = rows.filter(row => {
                    const g = row['Grade'] || row['Grado'] || '';
                    return parseFloat(g).toFixed(2) === target;
                });
                
                if (rows.length === 0) {
                    throw new Error(`No se encontraron registros del grado ${filterGrade}`);
                }
            }

            setStatus(`Procesando ${rows.length} registros...`);

            // 3. Process Data & Generate Sequences
            const processedRows = [];
            
            // ... (rest of logic uses 'rows')
            const sequenceMap = {}; // Cache to avoid hitting API too hard if we can estimate? 
            // In the web app, it called API for sequence? 
            // Web app: getNextBatchSequence called for each row if not in map?
            // "if (!sequenceMap[normalizedGrade]) ... getNextBatchSequence ... else seq++"
            // Yes, it batches locally per grade.

            for (const row of rows) {
                // Map columns
                // Safety Check: ensure row is object
                if (typeof row !== 'object' || row === null) continue;

                const getCol = (name) => {
                    const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
                    return key ? row[key] : '';
                };
                
                const data = {
                    SAE: getCol('SAE') || 'SAE 1010',
                    Grade: getCol('Grade') || getCol('Grado') || '7.00',
                    HeatNo: getCol('HeatNo') || getCol('Colada') || '',
                    BundleNo: getCol('BundleNo') || '',
                    Weight: getCol('Weight') || getCol('Peso') || '0',
                    // NUEVO: Extraer Lote directamente de la Hoja
                    ExistingBatch: getCol('Batch') || getCol('Lote') || ''
                };

                const gradeVal = data.Grade;
                const normalizeGrade = (g) => {
                     try {
                        return g ? parseFloat(g).toFixed(2) : "0.00";
                     } catch(e) { return "0.00"; }
                };
                const normGrade = normalizeGrade(gradeVal);
                
                let batch = '';

                // ESTRATEGIA: Usar Lote Existente si Disponible (Recomendado)
                if (data.ExistingBatch) {
                    batch = data.ExistingBatch;
                } else {
                    // Respaldo: Lógica de Generación de Secuencia
                    if (!sequenceMap[normGrade]) {
                        try {
                            const seqData = await getNextBatchSequence(normGrade);
                            const startSeq = seqData.seq;
                            setStatus(`Grado ${normGrade}: Iniciando en ${startSeq}...`);
                            
                            sequenceMap[normGrade] = {
                                seq: startSeq,
                                dateStr: seqData.dateStr,
                                baseDate: new Date()
                            };
                        } catch (e) {
                             console.warn("Seq fetch failed, using local fallback", e);
                             // Fallback date
                             const now = new Date();
                             const dStr = `${now.getFullYear().toString().slice(-2)}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
                             sequenceMap[normGrade] = { seq: 1, dateStr: dStr, baseDate: now };
                        }
                    } else {
                        sequenceMap[normGrade].seq++;
                    }
                    
                    // Rollover logic (locally)
                     if (sequenceMap[normGrade].seq > 999) {
                        sequenceMap[normGrade].seq = 1;
                    }
    
                    // Format Batch
                    batch = `${sequenceMap[normGrade].dateStr}I${sequenceMap[normGrade].seq.toString().padStart(3, '0')}`;
                }
                
                // Lógica de SKU (Actualizada desde Imagen)
                const SKU_MAP = {
                    "5.50": "10000241", 
                    "6.00": "10000285", 
                    "6.50": "10000248",
                    "7.00": "10000271", 
                    "8.00": "10000003", 
                    "9.00": "10000288",
                    "10.00": "10000287", 
                    "12.00": "10000240"
                };
                const sku = SKU_MAP[normGrade] || "00000000";

                processedRows.push({
                    ...data,
                    Batch: batch,
                    Sku: sku
                });
            }

            setStatus('Generando PDF...');

            // 4. Generate HTML for PDF
            const html = generateHtml(processedRows);

            // 5. Create PDF
            const { uri } = await Print.printToFileAsync({ html, width: 340, height: 226 }); // 120mm x 80mm
            
            setStatus('Compartiendo PDF...');
            await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            
            Alert.alert("Éxito", "PDF Generado");

        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <View style={styles.container}>
             <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Generación Masiva</Text>
            </View>

            <View style={styles.content}>
                
                {/* Filtro Global de Grado */}
                <Text style={styles.label}>Filtrar por Grado/Medida:</Text>
                <View style={styles.gradeContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['5.50', '6.00', '6.50', '7.00', '8.00', '9.00', '10.00', '11.00', '12.00'].map((g) => (
                            <TouchableOpacity
                                key={g}
                                style={[
                                    styles.gradeButton,
                                    filterGrade === g && styles.gradeButtonSelected
                                ]}
                                onPress={() => setFilterGrade(filterGrade === g ? '' : g)}
                            >
                                <Text style={[
                                    styles.gradeButtonText,
                                    filterGrade === g && styles.gradeButtonTextSelected
                                ]}>{g}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.divider} />

                <View style={styles.externalSection}>
                    <Text style={styles.sectionTitle}>Importar desde Sheet Externo</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Pegar enlace de Google Sheet aquí..."
                        placeholderTextColor="#999"
                        value={externalUrl}
                        onChangeText={setExternalUrl}
                    />
                    <TouchableOpacity 
                        style={[styles.button, styles.externalButton, loading && styles.disabled]} 
                        onPress={() => handleGenerate(true)} 
                        disabled={loading || !externalUrl}
                    >
                         <Text style={styles.buttonText}>{loading ? 'Procesando...' : 'Obtener etiquetas de hoja externa'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Generar desde Base de Datos Principal</Text>
                
                <TouchableOpacity 
                    style={[styles.button, loading && styles.disabled]} 
                    onPress={() => handleGenerate(false)}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Procesando...' : 'Generar PDF'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const generateHtml = (rows) => {
    const pages = rows.map((row) => {
        // Barcode Value
        const weightKg = parseFloat(row.Weight) || 0;
        const weightTons = (weightKg / 1000).toFixed(3); // 3 decimals for tons
        
        // Ensure no spaces or special chars that break URL
        const barcodeValue = `${row.Sku}-${row.Batch}-${weightTons}`;
        
        // Use bwip-js API for consistent rendering
        // bcid=code128, text=value, scale=2, height=10 (mm approx inverted?), incltext=true
        const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeValue)}&scaleY=0.5&scaleX=0.4&height=10&includeText&textxalign=center`;

        return `
        <div class="page">
            <div class="header-sku">${row.Sku}</div>
            
            <div class="title">
                ALAMBRON ${parseFloat(row.Grade).toFixed(2)} MM ${row.SAE}
            </div>
            
            <div class="grid">
                <div class="label">Peso:</div>
                <div class="value">${weightTons} T</div>
                <div class="label-right">N° OT:</div>
                
                <div class="label">Largo:</div>
                <div class="value">N/A</div>
                <div class="label-right">Ancho:</div>
                
                <div class="label">Grado:</div>
                <div class="value">${row.SAE.replace(/\s+/g, '')}</div>
                <div class="na-right">N/A</div>
                
                <div class="label">Lote:</div>
                <div class="value">${row.Batch}</div>
                <div class="retenido-container">
                    <div class="checkbox"></div>
                    <div class="retenido-text">RETENIDO</div>
                </div>
            </div>
            
            <div class="barcode-container">
                <img src="${barcodeUrl}" class="barcode-img" alt="Barcode" />
            </div>
        </div>
        `;
    }).join('');

    return `
    <html>
      <head>
        <style>
          @page { size: 120mm 80mm; margin: 0; }
          body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
          .page {
            width: 120mm;
            height: 80mm;
            position: relative;
            background: white;
            overflow: hidden;
            page-break-after: always;
            box-sizing: border-box;
            padding: 4mm;
          }
          
          .header-sku {
              text-align: right;
              font-size: 24pt;
              margin-top: 2mm;
              margin-right: 2mm;
              font-weight: normal;
          }
          
          .title {
              text-align: center;
              font-size: 20pt; 
              font-weight: bold;
              margin-top: 2mm;
              margin-bottom: 4mm;
              white-space: nowrap;
          }
          
          .grid {
            display: grid;
            grid-template-columns: 20mm 40mm 30mm;
            row-gap: 3mm;
            margin-left: 2mm;
            font-size: 12pt;
          }
          
          .label { font-weight: normal; }
          .label-right { text-align: right; padding-right: 2mm; }
          .value { font-weight: normal; text-align: center; font-size: 14pt; }
          .na-right { text-align: center; padding-left: 10mm; }
          
          .retenido-container {
              display: flex;
              align-items: center;
              justify-content: flex-end;
              border: 1px solid black;
              padding: 2px;
              width: fit-content;
              margin-left: auto;
          }
          .checkbox {
              width: 12px;
              height: 12px;
              border: 1px solid black;
              margin-right: 4px;
          }
          .retenido-text {
              font-size: 10pt;
              font-weight: bold;
          }

          .barcode-container {
            position: absolute;
            bottom: 2mm;
            left: 0;
            width: 100%;
            text-align: center;
            display: flex;
            justify-content: center;
            align-items: flex-end;
          }
          .barcode-img {
              width: 80%; /* Constrain width to ensure quiet zones */
              height: auto; 
              max-height: 15mm;
          }
        </style>
      </head>
      <body>
        ${pages}
      </body>
    </html>
    `;
};



const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#121212', // Dark Background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: { 
        padding: 20, 
        backgroundColor: '#000', // Black
        flexDirection: 'row', 
        alignItems: 'center',
        elevation: 4,
        borderBottomWidth: 2,
        borderBottomColor: '#D32F2F',
    },
    backButton: { marginRight: 15 },
    backText: { fontSize: 16, color: '#DDD' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
    content: { padding: 20 },
    label: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#E0E0E0' },
    input: { 
        borderWidth: 1, 
        borderColor: '#444', 
        borderRadius: 8, 
        padding: 12, 
        marginBottom: 20, 
        color: '#FFF', 
        backgroundColor: '#2C2C2C' // Dark Input
    },
    button: { 
        backgroundColor: '#000', 
        padding: 15, 
        borderRadius: 8, 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D32F2F',
        marginTop: 10
    },
    buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
    gradeContainer: { flexDirection: 'row', marginBottom: 20, height: 50 },
    gradeButton: { 
        backgroundColor: '#333', 
        paddingHorizontal: 15, 
        paddingVertical: 10, 
        borderRadius: 20, 
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#555'
    },
    gradeButtonSelected: { 
        backgroundColor: '#D32F2F',
        borderColor: '#D32F2F'
    },
    gradeButtonText: { fontSize: 16, color: '#DDD' },
    gradeButtonTextSelected: { color: 'white', fontWeight: 'bold' },
    status: { textAlign: 'center', marginBottom: 10, color: '#BBB' },
    disabled: { opacity: 0.7 },
    externalSection: {
        marginBottom: 20,
        backgroundColor: '#1E1E1E', // Dark Card
        padding: 15,
        borderRadius: 8,
        elevation: 2
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#D32F2F',
    },
    externalButton: {
        backgroundColor: '#333', 
        borderColor: '#555',
        borderWidth: 1
    }
});
