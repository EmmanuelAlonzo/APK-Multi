import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const role = user?.role?.toLowerCase() || 'auxiliar';
    
    // Permissions
    const canBulk = role !== 'auxiliar';
    const canViewDB = role !== 'auxiliar';
    
    const openDB = () => {
        Linking.openURL('https://docs.google.com/spreadsheets/d/1wWQOdv-RXnOSwBWfwVBvdu9Rf2cE5aRjNAc8cPTDp8o/edit?usp=sharing');
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
        backgroundColor: '#E5E5E5', // "Atenuar blanco" -> Concrete Grey
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        padding: 20,
        backgroundColor: '#111', // "Utiliza el negro" -> Black Header
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 4,
        borderBottomWidth: 2,
        borderBottomColor: '#D32F2F', // Red accent line
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF', // White text on Black
    },
    welcome: {
        fontSize: 14,
        color: '#BBB', // Light grey text
    },
    username: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    roleTag: {
        fontSize: 11,
        color: '#D32F2F', // Red role tag
        fontWeight: 'bold',
        marginTop: 2,
        letterSpacing: 1,
    },
    settingsIcon: {
        fontSize: 24,
        color: 'white', // White icon
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
        backgroundColor: '#ffebee',
        borderWidth: 0,
    },
    logoutText: {
        color: '#d32f2f',
    },
    // Admin Items
    adminItem: {
        backgroundColor: '#F5F5F5',
        borderLeftColor: '#000' // Black border for admin to distinguish? Or Red? Let's stick to Red theme.
    },
    card: {
        width: '48%',
        backgroundColor: '#FFFFFF', // Clean White cards stand out on Grey BG
        padding: 20,
        borderRadius: 8, // Sharper corners for "Industrial" look
        alignItems: 'center',
        marginBottom: 15,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        borderLeftWidth: 5, 
        borderLeftColor: '#D32F2F', // Brand Red
    },
    dbCard: {
        backgroundColor: '#FFF',
        borderLeftColor: '#333' // Dark Grey/Black for variety? Or Red? Keeping consistent.
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
        color: '#D32F2F' // Red Icon
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111', // Black Text
        textAlign: 'center',
        marginTop: 5
    }
});
