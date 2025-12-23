import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { getScriptUrl, DEFAULT_SCRIPT_URL } from '../utils/storage';
import { Picker } from '@react-native-picker/picker';

export default function LoginScreen({ navigation }) {
    const { userList, loadingUsers, refreshUsers, login, error } = useContext(AuthContext);
    
    const [selectedUser, setSelectedUser] = useState(null);
    const [pin, setPin] = useState('');
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        // Auto-refresh users on mount if empty
        if (userList.length === 0) {
            refreshUsers();
        }
    }, []);

    useEffect(() => {
        // Set default selection if list populates
        if (userList.length > 0 && !selectedUser) {
            setSelectedUser(userList[0]);
        }
    }, [userList]);

    const handleLogin = () => {
        if (!selectedUser) {
            Alert.alert("Error", "Selecciona un usuario");
            return;
        }
        if (!pin) {
            Alert.alert("Error", "Ingresa tu PIN");
            return;
        }

        setVerifying(true);
        // Simulate small delay for UX? No need.
        const success = login(selectedUser, pin);
        setVerifying(false);

        if (success) {
            // Navigation handled by App.js condition? 
            // Or we can navigate manually if App.js structure allows.
            // But integrating with Context usually means state change triggers re-render of Navigator.
            // Let's assume App.js will handle it or we navigate to Home.
            // If we use Stack Navigator with condition, it's automatic.
            // IF NOT, we push. Let's assume condition strategy in App.js.
        } else {
            Alert.alert("Acceso Denegado", "PIN incorrecto");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.appName}>Control de MP</Text>
                    <Text style={styles.version}>v1.0.3</Text>
                </View>

                {loadingUsers ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#2196F3" />
                        <Text style={styles.loadingText}>Cargando usuarios...</Text>
                    </View>
                ) : (
                    <View style={styles.formContainer}>
                        
                        {userList.length === 0 ? (
                            <View>
                                <Text style={styles.errorText}>
                                    {error ? `Error: ${error}` : "No se encontraron usuarios."}
                                </Text>
                                <TouchableOpacity style={styles.retryButton} onPress={refreshUsers}>
                                    <Text style={styles.retryText}>Reintentar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.configLink} onPress={() => navigation.navigate('Settings')}>
                                    <Text style={styles.configText}>Ir a Configuración</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.label}>Selecciona tu Usuario:</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={selectedUser}
                                        onValueChange={(itemValue) => setSelectedUser(itemValue)}
                                    >
                                        {userList.map((u, index) => (
                                            <Picker.Item key={index} label={u.name} value={u} />
                                        ))}
                                    </Picker>
                                </View>

                                <Text style={styles.label}>PIN de Acceso:</Text>
                                <TextInput
                                    style={styles.input}
                                    value={pin}
                                    onChangeText={setPin}
                                    placeholder="Ingrese PIN"
                                    placeholderTextColor="#888"
                                    keyboardType="numeric"
                                    secureTextEntry
                                    maxLength={4}
                                />

                                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                                    <Text style={styles.loginButtonText}>{verifying ? "Verificando..." : "INGRESAR"}</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity style={styles.refreshLink} onPress={refreshUsers}>
                                    <Text style={styles.refreshText}>Actualizar lista de usuarios</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
            <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                    <Text style={styles.footerLink}>Configuración de Conexión</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E5E5E5', // Concrete Grey
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 100,
        height: 100, 
        marginBottom: 10,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#D32F2F', // Corporate Red for Title
        letterSpacing: 1,
    },
    version: {
        color: '#666',
        fontSize: 12,
    },
    formContainer: {
        backgroundColor: '#FFFFFF', // White form on Grey BG
        padding: 20,
        borderRadius: 8,
        elevation: 4,
        borderTopWidth: 5,
        borderTopColor: '#D32F2F' // Red accent top
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: '#333',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#111', // Black Text
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        marginBottom: 20,
        backgroundColor: '#F9F9F9',
    },
    input: {
        backgroundColor: '#F9F9F9',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 5,
        color: '#000',
    },
    loginButton: {
        backgroundColor: '#111', // Black Button
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D32F2F' // Red Border
    },
    loginButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    errorText: {
        color: '#D32F2F',
        textAlign: 'center',
        marginBottom: 10,
        fontWeight: 'bold'
    },
    retryButton: {
        padding: 10,
        alignItems: 'center',
    },
    retryText: {
        color: '#D32F2F',
        fontWeight: 'bold',
    },
    refreshLink: {
        marginTop: 15,
        alignItems: 'center',
    },
    refreshText: {
        color: '#666',
        fontSize: 12,
    },
    configLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    configText: {
        color: '#666',
        textDecorationLine: 'underline',
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerLink: {
        color: '#888',
        fontSize: 12,
    }
});
