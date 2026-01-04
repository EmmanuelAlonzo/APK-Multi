import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, ScrollView, Switch } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveScriptUrl, getScriptUrl, DEFAULT_SCRIPT_URL, savePreferredBrowser, getPreferredBrowser } from '../utils/storage';

export default function SettingsScreen({ navigation, route }) {
    // URL ahora es lógica de solo lectura o fija.

    const [url, setUrl] = useState('');
    const [selectedBrowser, setSelectedBrowser] = useState(null); // null = No seteado / Auto
    const { user, logout } = React.useContext(require('../context/AuthContext').AuthContext);
    const { isDark, toggleTheme, colors } = React.useContext(ThemeContext);
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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: colors.accent }]}>Configuración</Text>

                {/* Solo Información de Script (No Editar) */}
                <View style={[styles.infoBox, { backgroundColor: colors.card, borderLeftColor: colors.accent }]}>
                    <Text style={[styles.label, { color: colors.text }]}>Estado de Conexión:</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        Conectado a Google Apps Script (V10 - Edición Remota + ID Único)
                    </Text>
                    <Text style={[styles.description, { fontSize: 10, color: colors.textSecondary }]}>{url}</Text>
                </View>

                {/* --- SECCIÓN TEMA --- */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={[styles.label, { color: colors.text }]}>Modo Oscuro</Text>
                            <Text style={[styles.description, { color: colors.textSecondary, marginBottom: 0 }]}>
                                {isDark ? 'Activado' : 'Desactivado'}
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#767577", true: colors.accent }}
                            thumbColor={isDark ? "#f4f3f4" : "#f4f3f4"}
                            ios_backgroundColor="#3e3e3e"
                            onValueChange={toggleTheme}
                            value={isDark}
                        />
                    </View>
                </View>

                {/* --- SECCIÓN NAVEGADOR PREDETERMINADO --- */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text }]}>Navegador para Base de Datos</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>Elige con qué app abrir los enlaces:</Text>

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
                                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                                    selectedBrowser === b.pkg && { backgroundColor: colors.accent, borderColor: colors.accent }
                                ]}
                                onPress={() => handleSelectBrowser(b.pkg)}
                            >
                                <Text style={[
                                    styles.browserOptionText,
                                    { color: colors.textSecondary },
                                    selectedBrowser === b.pkg && { color: '#FFF' }
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
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <Text style={[styles.label, { color: colors.text }]}>Cambiar Contraseña (PIN)</Text>
                        <Text style={[styles.description, { color: colors.textSecondary }]}>
                            Usuario actual: {user.name}
                        </Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                            value={newPin}
                            onChangeText={setNewPin}
                            placeholder="Nuevo PIN (ej. 1234)"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                            secureTextEntry
                        />
                        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={handleChangePin} disabled={changingPin}>
                            <Text style={styles.buttonText}>{changingPin ? "Actualizando..." : "Actualizar PIN"}</Text>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={[styles.button, { backgroundColor: colors.card, borderColor: colors.error }]} onPress={handleLogout}>
                            <Text style={[styles.buttonText, { color: colors.error }]}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                    </View>
                )}


                {!isInitial && (
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
                        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Volver</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor handled by context
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
        // color handled
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        // color handled
    },
    description: {
        fontSize: 14,
        // color handled
        marginBottom: 12,
    },
    input: {
        // bg, border handled
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        minHeight: 50,
        // color handled
    },
    button: {
        // bg handled
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
    },
    buttonText: {
        // color handled or white
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    cancelButtonText: {
        fontSize: 16,
    },
    section: {
        marginTop: 20,
    },
    divider: {
        height: 1,
        marginBottom: 20,
    },
    pinButton: {
        borderWidth: 0
    },
    logoutButton: {
        borderWidth: 1
    },
    infoBox: {
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 4,
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
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10,
        alignItems: 'center'
    },
    browserOptionSelected: {
        // handled inline
    },
    browserOptionText: {
        fontWeight: 'bold'
    },
    browserOptionTextSelected: {
        color: '#fff'
    }
});
