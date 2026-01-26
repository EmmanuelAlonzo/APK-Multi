import React, { useState, useEffect, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getScriptUrl } from './src/utils/storage';
import { AuthProvider, AuthContext } from './src/context/AuthContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ManualScreen from './src/screens/ManualScreen';
import BulkScreen from './src/screens/BulkScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GlobalHistoryScreen from './src/screens/GlobalHistoryScreen'; // Nuevo
import LoginScreen from './src/screens/LoginScreen';

const Stack = createStackNavigator();

const AppContent = () => {
    const { user } = useContext(AuthContext);
    const [initialRoute, setInitialRoute] = useState(null);

    useEffect(() => {
        checkConfiguration();
    }, []);

    const checkConfiguration = async () => {
        try {
            const url = await getScriptUrl();
            // Si tenemos URL, verificamos auth. 
            // Si no, forzamos Configuración (que es accesible vía enlace Configuración en Login de todos modos, 
            // pero mantengamos la lógica simple: Si no hay usuario, mostrar Login).
            if (url) {
                setInitialRoute('Home');
            } else {
                setInitialRoute('Settings');
            }
        } catch (e) {
            setInitialRoute('Settings');
        }
    };

    if (!initialRoute) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    // Pila de Autenticación
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                    </>
                ) : (
                    // Pila de Aplicación
                    <>
                        <Stack.Screen name="Home" component={HomeScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="Scanner" component={ScannerScreen} />
                        <Stack.Screen name="Manual" component={ManualScreen} />
                        <Stack.Screen name="Bulk" component={BulkScreen} />
                        <Stack.Screen name="History" component={HistoryScreen} />
                        <Stack.Screen name="GlobalHistory" component={GlobalHistoryScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default function App() {
    const [isLocked, setIsLocked] = useState(false);
    const [isLoadingLock, setIsLoadingLock] = useState(true);

    // --- KILL SWITCH CONFIG ---
    // Shared Gist with Reclamos_Multi
    const CONFIG_URL = "https://gist.githubusercontent.com/EmmanuelAlonzo/fc6b020ef1b8b970d8b9dbfee84556b3/raw/status.json"; 

    useEffect(() => {
        checkLockStatus();
    }, []);

    const checkLockStatus = async () => {
        try {
            // 1. Check Local (Sticky)
            const stored = await AsyncStorage.getItem('KILL_SWITCH_STATUS');
            if (stored === 'LOCKED') {
                setIsLocked(true);
            }

            // 2. Check Remote
            console.log("Checking remote lock status...");
            const response = await fetch(CONFIG_URL, { cache: "no-store" });
            const data = await response.json();
            
            if (data.enabled === false) {
                setIsLocked(true);
                await AsyncStorage.setItem('KILL_SWITCH_STATUS', 'LOCKED');
            } else {
                setIsLocked(false);
                await AsyncStorage.removeItem('KILL_SWITCH_STATUS');
            }

        } catch (e) {
            console.log("Lock check failed:", e);
        } finally {
            setIsLoadingLock(false);
        }
    };

    if (isLoadingLock) return null; // Or splash

    if (isLocked) {
        return (
            <View style={styles.lockedContainer}>
                <Text style={styles.lockedTitle}>⛔ Acceso Denegado</Text>
                <Text style={styles.lockedText}>Esta aplicación ha sido desactivada.</Text>
            </View>
        );
    }

    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

const styles = StyleSheet.create({
  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222', padding: 20 },
  lockedTitle: { fontSize: 28, fontWeight: 'bold', color: 'red', marginBottom: 20 },
  lockedText: { fontSize: 18, color: 'white', textAlign: 'center' }
});
