import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

import * as WebBrowser from 'expo-web-browser';
import { getPreferredBrowser } from '../utils/storage';

export default function HomeScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const role = user?.role?.toLowerCase() || 'auxiliar';
    
    // Permisos
    const canBulk = role !== 'auxiliar';
    const canViewDB = role !== 'auxiliar';
    
    const openDB = async () => {
        const url = 'https://docs.google.com/spreadsheets/d/1wWQOdv-RXnOSwBWfwVBvdu9Rf2cE5aRjNAc8cPTDp8o/edit?usp=sharing';
        const pref = await getPreferredBrowser(); // Retorna null si no se ha elegido nada

        // 1. Validación Estricta: Si no ha elegido navegador, BLOQUEAR y avisar.
        if (!pref) {
            alert("Acción Requerida: Por favor ve a Configuración (⚙️) y selecciona un navegador seguro (Chrome, Brave o Edge) para visualizar la base de datos.");
            return;
        }

        // 2. Intentar abrir SOLO con el navegador seleccionado
        try {
            await WebBrowser.openBrowserAsync(url, { browserPackage: pref });
        } catch (e) {
            // 3. Si falla (ej. eligió Chrome pero no lo tiene instalado), avisar error.
            alert("Error: No se pudo abrir el navegador seleccionado. Verifica que la aplicación esté instalada en tu dispositivo.");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcome}>Bienvenido,</Text>
                    <Text style={styles.username}>{user ? user.name : 'Usuario'}</Text>
                    <Text style={styles.roleTag}>{role.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                    <Text style={styles.settingsIcon}>⚙️</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.grid}>
                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Scanner')}>
                    <Text style={styles.cardIcon}>📷</Text>
                    <Text style={styles.cardTitle}>Escanear QR</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Manual')}>
                    <Text style={styles.cardIcon}>📝</Text>
                    <Text style={styles.cardTitle}>Ingreso Manual</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('History')}>
                    <Text style={styles.cardIcon}>📋</Text>
                    <Text style={styles.cardTitle}>Historial / Editar</Text>
                </TouchableOpacity>

                {['administrador', 'supervisor', 'verificador'].includes(role) && (
                    <TouchableOpacity style={[styles.card, styles.adminItem]} onPress={() => navigation.navigate('GlobalHistory')}>
                        <Text style={styles.cardIcon}>🌎</Text>
                        <Text style={styles.cardTitle}>Gestión Global</Text>
                    </TouchableOpacity>
                )}

                {canBulk && (
                    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Bulk')}>
                        <Text style={styles.cardIcon}>📑</Text>
                        <Text style={styles.cardTitle}>Generación Masiva</Text>
                    </TouchableOpacity>
                )}

                {canViewDB && (
                     <TouchableOpacity style={[styles.card, styles.dbCard]} onPress={openDB}>
                        <Text style={styles.cardIcon}>☁️</Text>
                        <Text style={styles.cardTitle}>Base de Datos (Web)</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const MenuButton = ({ title, icon, onPress, color }) => (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Dark Background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        padding: 20,
        backgroundColor: '#000', // Pure Black Header
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 4,
        borderBottomWidth: 2,
        borderBottomColor: '#D32F2F', 
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF', 
    },
    welcome: {
        fontSize: 14,
        color: '#BBB', 
    },
    username: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    roleTag: {
        fontSize: 11,
        color: '#D32F2F', 
        fontWeight: 'bold',
        marginTop: 2,
        letterSpacing: 1,
    },
    settingsIcon: {
        fontSize: 24,
        color: 'white',
        opacity: 0.9,
    },
    menu: {
        padding: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: 20, 
    },
    logoutButton: {
        marginTop: 20,
        backgroundColor: '#2C2C2C', // Darkened
        borderWidth: 0,
    },
    logoutText: {
        color: '#d32f2f',
    },
    // Ítems de Admin
    adminItem: {
        backgroundColor: '#1A1A1A', // Slightly darker than cards
        borderLeftColor: '#FFF' // White Accent for Admin
    },
    card: {
        width: '48%',
        backgroundColor: '#1E1E1E', // Dark Cards
        padding: 20,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        borderLeftWidth: 5, 
        borderLeftColor: '#D32F2F', 
    },
    dbCard: {
        backgroundColor: '#1E1E1E',
        borderLeftColor: '#555' 
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        backgroundColor: '#D32F2F', 
    },
    icon: {
        fontSize: 24,
        color: 'white', 
    },
    cardIcon: {
        fontSize: 32,
        marginBottom: 10,
        color: '#D32F2F' 
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#EEE', // Light Text
        textAlign: 'center',
        marginTop: 5
    }
});
