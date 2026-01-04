import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator, Platform, StatusBar, Modal, FlatList, ScrollView, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { getScriptUrl, DEFAULT_SCRIPT_URL } from '../utils/storage';

export default function LoginScreen({ navigation }) {
    const { userList, loadingUsers, refreshUsers, login, error } = useContext(AuthContext);
    const { colors, isDark } = useContext(ThemeContext);

    const [selectedUser, setSelectedUser] = useState(null);
    const [pin, setPin] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        // Auto-actualizar usuarios al montar si está vacío
        if (userList.length === 0) {
            refreshUsers();
        }
    }, []);

    useEffect(() => {
        // Establecer selección por defecto si la lista se llena
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
        // ¿Simular pequeño retraso para UX? No es necesario.
        const success = login(selectedUser, pin);
        setVerifying(false);

        if (success) {
            // ¿Navegación manejada por condición en App.js? 
            // O podemos navegar manualmente si la estructura de App.js lo permite.
            // Pero integrar con Context usualmente significa que el cambio de estado dispara re-renderizado del Navegador.
            // Asumamos que App.js lo manejará o navegamos a Home.
            // Si usamos Stack Navigator con condición, es automático.
            // SI NO, empujamos. Asumamos estrategia de condición en App.js.
        } else {
            Alert.alert("Acceso Denegado", "PIN incorrecto");
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.logoContainer}>
                        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
                        <Text style={[styles.appName, { color: colors.accent }]}>Control de MP</Text>
                        <Text style={[styles.version, { color: colors.textSecondary }]}>v1.0.3</Text>
                    </View>

                    {loadingUsers ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando usuarios...</Text>
                        </View>
                    ) : (
                        <View style={[styles.formContainer, { backgroundColor: colors.card, borderTopColor: colors.accent }]}>

                            {userList.length === 0 ? (
                                <View>
                                    <Text style={[styles.errorText, { color: colors.error }]}>
                                        {error ? `Error: ${error}` : "No se encontraron usuarios."}
                                    </Text>
                                    <TouchableOpacity style={styles.retryButton} onPress={refreshUsers}>
                                        <Text style={[styles.retryText, { color: colors.accent }]}>Reintentar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.configLink} onPress={() => navigation.navigate('Settings')}>
                                        <Text style={[styles.configText, { color: colors.textSecondary }]}>Ir a Configuración</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.label, { color: colors.text }]}>Selecciona tu Usuario:</Text>
                                    <View style={styles.pickerContainer}>
                                        <TouchableOpacity
                                            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                            onPress={() => setModalVisible(true)}
                                        >
                                            <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                                                {selectedUser ? selectedUser.name : "Seleccionar..."}
                                            </Text>
                                            <Text style={[styles.pickerIcon, { color: colors.accent }]}>▼</Text>
                                        </TouchableOpacity>

                                        <Modal
                                            animationType="fade"
                                            transparent={true}
                                            visible={modalVisible}
                                            onRequestClose={() => setModalVisible(false)}
                                        >
                                            <View style={styles.modalOverlay}>
                                                <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.accent }]}>
                                                    <Text style={[styles.modalTitle, { color: colors.accent, borderBottomColor: colors.border }]}>Seleccionar Usuario</Text>
                                                    <FlatList
                                                        data={userList}
                                                        keyExtractor={(item, index) => index.toString()}
                                                        renderItem={({ item }) => (
                                                            <TouchableOpacity
                                                                style={[styles.modalItem, { borderBottomColor: colors.border }]}
                                                                onPress={() => {
                                                                    setSelectedUser(item);
                                                                    setModalVisible(false);
                                                                }}
                                                            >
                                                                <Text style={[styles.modalItemText, { color: colors.text }]}>{item.name}</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    />
                                                    <TouchableOpacity
                                                        style={[styles.modalCloseButton, { backgroundColor: colors.inputBackground }]}
                                                        onPress={() => setModalVisible(false)}
                                                    >
                                                        <Text style={[styles.modalCloseText, { color: colors.text }]}>Cerrar</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </Modal>
                                    </View>

                                    <Text style={[styles.label, { color: colors.text }]}>PIN de Acceso:</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                                        value={pin}
                                        onChangeText={setPin}
                                        placeholder="Ingrese PIN"
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="numeric"
                                        secureTextEntry
                                        maxLength={4}
                                    />

                                    <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={handleLogin}>
                                        <Text style={styles.loginButtonText}>{verifying ? "Verificando..." : "INGRESAR"}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.refreshLink} onPress={refreshUsers}>
                                        <Text style={[styles.refreshText, { color: colors.textSecondary }]}>Actualizar lista de usuarios</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Configuración de Conexión</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        color: '#D32F2F',
        letterSpacing: 1,
    },
    version: {
        color: '#888',
        fontSize: 12,
    },
    formContainer: {
        backgroundColor: '#1E1E1E', // Dark Card
        padding: 20,
        borderRadius: 8,
        elevation: 4,
        borderTopWidth: 5,
        borderTopColor: '#D32F2F'
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: '#DDD',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#E0E0E0', // Light Text
    },
    pickerContainer: {
        marginBottom: 20,
    },
    pickerButton: {
        backgroundColor: '#2C2C2C',
        borderWidth: 1,
        borderColor: '#444',
        borderRadius: 8,
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    pickerIcon: {
        color: '#D32F2F',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderRadius: 10,
        padding: 20,
        borderWidth: 1,
        borderColor: '#D32F2F',
        maxHeight: '80%',
    },
    modalTitle: {
        color: '#D32F2F',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingBottom: 10
    },
    modalItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    modalItemText: {
        color: '#FFF',
        fontSize: 16,
        textAlign: 'center'
    },
    modalCloseButton: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#333',
        borderRadius: 8,
        alignItems: 'center'
    },
    modalCloseText: {
        color: '#FFF',
        fontWeight: 'bold'
    },
    input: {
        backgroundColor: '#2C2C2C', // Same as Picker
        borderWidth: 1,             // Same as Picker
        borderColor: '#444',        // Same as Picker
        borderRadius: 8,
        padding: 12,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 5,
        color: '#FFFFFF',
    },
    loginButton: {
        backgroundColor: '#D32F2F', // Red Background (Visible)
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#B71C1C'
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
        color: '#CCCCCC', // Light Text
        fontSize: 14,
        textDecorationLine: 'underline'
    },
    configLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    configText: {
        color: '#AAAAAA', // Light Grey
        textDecorationLine: 'underline',
    },
    footerLink: {
        color: '#666',
        fontSize: 12,
    }
});
