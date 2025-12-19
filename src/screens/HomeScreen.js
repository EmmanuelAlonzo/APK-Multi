import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, Platform, StatusBar, Linking } from 'react-native';
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
        backgroundColor: '#f0f2f5',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    roleTag: {
        fontSize: 10,
        color: '#666',
        fontWeight: 'bold',
        marginTop: 2
    },
    settingsIcon: {
        fontSize: 24,
    },
    menu: {
        padding: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: 20, // Added padding to grid for consistency
    },
    card: {
        width: '48%',
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        marginBottom: 15,
        elevation: 2,
        // The original card had borderLeftWidth: 5, which is not in the new definition.
        // Assuming the user wants to keep it or it was an oversight in the instruction.
        // For now, I'll keep it as it was in the original card style.
        // If the intention was to remove it, the instruction should be more explicit.
        // Based on the instruction's malformed part, it seems borderLeftWidth: 5 was intended to be kept.
        borderLeftWidth: 5, 
        borderLeftColor: '#ddd', // Added a default border color for the left border
    },
    dbCard: {
        backgroundColor: '#E3F2FD'
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    icon: {
        fontSize: 24,
        color: 'white',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    }
});
