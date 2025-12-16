import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Platform, StatusBar } from 'react-native';
import { saveScriptUrl, getScriptUrl, DEFAULT_SCRIPT_URL } from '../utils/storage';

export default function SettingsScreen({ navigation, route }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);

    // If param 'isInitial' is true, user cannot go back without saving
    const isInitial = route.params?.isInitial ?? false;

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const savedUrl = await getScriptUrl();
        setUrl(savedUrl || DEFAULT_SCRIPT_URL);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!url.trim()) {
            Alert.alert("Error", "La URL no puede estar vacía");
            return;
        }

        await saveScriptUrl(url.trim());
        Alert.alert("Éxito", "Configuración guardada", [
            { text: "OK", onPress: () => {
                if (isInitial) {
                    navigation.replace('Home');
                } else {
                    navigation.goBack();
                }
            }}
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Configuración</Text>
                
                <Text style={styles.label}>URL del Google Apps Script:</Text>
                <Text style={styles.description}>
                    Esta URL conecta tu app con la hoja de cálculo para sincronizar las secuencias y guardar datos.
                </Text>
                
                <TextInput
                    style={styles.input}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://script.google.com/..."
                    multiline
                />

                <TouchableOpacity style={styles.button} onPress={handleSave}>
                    <Text style={styles.buttonText}>Guardar y Continuar</Text>
                </TouchableOpacity>

                {!isInitial && (
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
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
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        minHeight: 80,
        textAlignVertical: 'top',
        color: '#000',
    },
    button: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: 'transparent',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
    }
});
