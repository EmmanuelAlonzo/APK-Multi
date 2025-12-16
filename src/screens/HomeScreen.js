import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Platform, StatusBar } from 'react-native';

export default function HomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Lector QR</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Settings', { isInitial: false })}>
                    <Text style={styles.settingsLink}>⚙️</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.menu}>
                <MenuButton 
                    title="Escanear QR" 
                    icon="📸" 
                    onPress={() => navigation.navigate('Scanner')} 
                    color="#2196F3"
                />
                <MenuButton 
                    title="Ingreso Manual" 
                    icon="📝" 
                    onPress={() => navigation.navigate('Manual')} 
                    color="#4CAF50"
                />
                <MenuButton 
                    title="Generación Masiva" 
                    icon="📑" 
                    onPress={() => navigation.navigate('Bulk')} 
                    color="#9C27B0"
                />
                <MenuButton 
                    title="Historial" 
                    icon="clock" 
                    onPress={() => navigation.navigate('History')} 
                    color="#FF9800"
                />
            </ScrollView>
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
    settingsLink: {
        fontSize: 24,
    },
    menu: {
        padding: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        borderLeftWidth: 5,
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
