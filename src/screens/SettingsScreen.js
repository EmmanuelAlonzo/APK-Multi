import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveScriptUrl, getScriptUrl, DEFAULT_SCRIPT_URL, savePreferredBrowser, getPreferredBrowser } from '../utils/storage';

export default function SettingsScreen({ navigation, route }) {
    // URL ahora es lógica de solo lectura o fija.
    
    const [url, setUrl] = useState('');
    const [selectedBrowser, setSelectedBrowser] = useState(null); // null = No seteado / Auto
    const { user, logout } = React.useContext(require('../context/AuthContext').AuthContext);
    const { updateUserPin } = require('../utils/api');

    const [newPin, setNewPin] = useState('');
    const [changingPin, setChangingPin] = useState(false);

    const isInitial = route.params?.isInitial ?? false;

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const savedUrl = await getScriptUrl();
        setUrl(savedUrl || DEFAULT_SCRIPT_URL);
        
        const savedBrowser = await getPreferredBrowser();
        setSelectedBrowser(savedBrowser);
    };

    const handleSelectBrowser = async (pkg) => {
        setSelectedBrowser(pkg);
        await savePreferredBrowser(pkg);
    };

    const handleChangePin = async () => {
        if (!user || !user.name) {
            Alert.alert("Error", "No hay usuario identificado para cambiar PIN");
            return;
        }
        if (!newPin.trim() || newPin.length < 4) {
             Alert.alert("Error", "El PIN debe tener al menos 4 dígitos");
             return;
        }

        setChangingPin(true);
        try {
            const success = await updateUserPin(user.name, newPin);
            if (success) {
                Alert.alert("Éxito", "Tu PIN ha sido actualizado");
                setNewPin('');
            } else {
                Alert.alert("Error", "No se pudo actualizar el PIN. Verifica tu conexión.");
            }
        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setChangingPin(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Cerrar Sesión",
            "¿Estás seguro de que deseas salir?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Salir", 
                    style: "destructive", 
                    onPress: async () => {
                       await logout();
                       // Forzar reinicio a Login para evitar quedarse en Configuración
                       // (ya que Configuración existe en pilas Auth y App)
                       navigation.reset({
                           index: 0,
                           routes: [{ name: 'Login' }],
                       });
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Configuración</Text>
                
                {/* Solo Información de Script (No Editar) */}
                <View style={styles.infoBox}>
                    <Text style={styles.label}>Estado de Conexión:</Text>
                    <Text style={styles.description}>
                        Conectado a Google Apps Script (V9 - Global SAE)
                    </Text>
                    <Text style={[styles.description, {fontSize: 10}]}>{url}</Text>
                </View>

                {/* --- SECCIÓN NAVEGADOR PREDETERMINADO --- */}
                <View style={styles.section}>
                    <Text style={styles.label}>Navegador para Base de Datos</Text>
                    <Text style={styles.description}>Elige con qué app abrir los enlaces:</Text>
                    
                    <View style={styles.browserOptions}>
                        {[
                            { name: 'Chrome', pkg: 'com.android.chrome' },
                            { name: 'Brave', pkg: 'com.brave.browser' },
                            { name: 'Edge', pkg: 'com.microsoft.emmx' }
                        ].map((b) => (
                            <TouchableOpacity 
                                key={b.name} 
                                style={[
                                    styles.browserOption, 
                                    selectedBrowser === b.pkg && styles.browserOptionSelected
                                ]}
                                onPress={() => handleSelectBrowser(b.pkg)}
                            >
                                <Text style={[
                                    styles.browserOptionText,
                                    selectedBrowser === b.pkg && styles.browserOptionTextSelected
                                ]}>
                                    {b.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* --- SECCIÓN CAMBIAR PIN --- */}
                {!isInitial && user && (
                    <View style={styles.section}>
                        <View style={styles.divider} />
                        <Text style={styles.label}>Cambiar Contraseña (PIN)</Text>
                        <Text style={styles.description}>
                            Usuario actual: {user.name}
                        </Text>
                        
                        <TextInput
                            style={styles.input}
                            value={newPin}
                            onChangeText={setNewPin}
                            placeholder="Nuevo PIN (ej. 1234)"
                            placeholderTextColor="#888"
                            keyboardType="numeric"
                            secureTextEntry
                        />
                         <TouchableOpacity style={[styles.button, styles.pinButton]} onPress={handleChangePin} disabled={changingPin}>
                            <Text style={styles.buttonText}>{changingPin ? "Actualizando..." : "Actualizar PIN"}</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />
                         <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
                            <Text style={styles.buttonText}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                    </View>
                )}


                {!isInitial && (
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelButtonText}>Volver</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Dark Background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#D32F2F' 
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#E0E0E0' // Light Text
    },
    description: {
        fontSize: 14,
        color: '#AAA', // Muted Text
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#2C2C2C', // Dark Input
        borderWidth: 1,
        borderColor: '#444',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        minHeight: 50,
        color: '#FFF', // White Input Text
    },
    button: {
        backgroundColor: '#000', 
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#D32F2F', 
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    cancelButtonText: {
        color: '#888',
        fontSize: 16,
    },
    section: {
        marginTop: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        marginBottom: 20,
    },
    pinButton: {
        backgroundColor: '#D32F2F', 
        borderWidth: 0
    },
    logoutButton: {
        backgroundColor: '#000', 
        borderColor: '#D32F2F',
        borderWidth: 1
    },
    infoBox: {
        backgroundColor: '#1E1E1E', // Dark Card
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#D32F2F',
        elevation: 2
    },
    browserOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 5,
        marginBottom: 15
    },
    browserOption: {
        width: '48%',
        backgroundColor: '#2C2C2C', // Dark Option
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#444',
        marginBottom: 10,
        alignItems: 'center'
    },
    browserOptionSelected: {
        backgroundColor: '#D32F2F',
        borderColor: '#D32F2F'
    },
    browserOptionText: {
        color: '#DDD',
        fontWeight: 'bold'
    },
    browserOptionTextSelected: {
        color: '#fff'
    }
});
