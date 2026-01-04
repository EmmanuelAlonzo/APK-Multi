import React, { useState, useEffect, useCallback, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPaginatedData, deleteFromSheet } from '../utils/api';

export default function GlobalHistoryScreen({ navigation }) {
    const { colors, isDark } = useContext(ThemeContext);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1); // Estimado
    const [totalRows, setTotalRows] = useState(0);

    const pageSize = 100;

    useEffect(() => {
        loadPage(1);
    }, []);

    const loadPage = async (p) => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetchPaginatedData(p, pageSize);
            setData(res.data);
            setTotalRows(res.total);
            setPage(res.page);
            // Calcular total de páginas
            const pages = Math.ceil(res.total / pageSize);
            setTotalPages(Math.max(1, pages));
        } catch (e) {
            Alert.alert("Error", "No se pudo cargar la base de datos: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (page < totalPages) loadPage(page + 1);
    };

    const handlePrev = () => {
        if (page > 1) loadPage(page - 1);
    };

    const handleEdit = (item) => {
        // Navegar a Pantalla Manual en "Modo Edición Remota"
        // Pasamos 'isRemote: true' para que ManualScreen sepa usar updateRemoteRow
        navigation.navigate('Manual', {
            isEditing: true,
            isRemote: true,
            item: item
        });
    };

    const handleDelete = (item) => {
        Alert.alert(
            "Borrar Registro",
            `¿Estás seguro de borrar el lote ${item.Batch}? Esto no se puede deshacer.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Borrar",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await deleteFromSheet(item.Batch, item.Grade);
                            Alert.alert("Éxito", "Registro borrado");
                            loadPage(page); // Recargar página actual
                        } catch (e) {
                            Alert.alert("Error", "Falló el borrado: " + e.message);
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderLeftColor: colors.accent }]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.batchId, { color: colors.text }]}>Lote: {item.Batch}</Text>
                <Text style={[styles.date, { color: colors.textSecondary }]}>{item.Date || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Grado:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{item.Grade}</Text>
                <Text style={[styles.label, { color: colors.textSecondary }]}>SAE:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{item.SAE}</Text>
            </View>
            <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Peso:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{item.Weight} kg</Text>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Colada:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{item.HeatNo}</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.actionBtn, styles.editBtn, { borderColor: '#FBC02D', backgroundColor: colors.background }]}>
                    <Text style={[styles.actionText, { color: colors.text }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn, { borderColor: colors.error, backgroundColor: colors.background }]}>
                    <Text style={[styles.actionText, { color: colors.text }]}>Borrar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.accent }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.headerText || '#DDD' }]}>← Volver</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.headerText || '#FFF' }]}>Base de Datos Global</Text>
                <TouchableOpacity onPress={() => loadPage(page)} style={styles.reloadButton}>
                    <Text style={[styles.reloadText, { color: colors.headerText || '#FFF' }]}>↻</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryText, { color: colors.text }]}>Total: {totalRows} registros</Text>
                <Text style={[styles.summaryText, { color: colors.text }]}>Página {page} de {totalPages}</Text>
            </View>

            {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />}

            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.Batch}_${item.Grade}_${index}`}
                contentContainerStyle={styles.list}
            />

            <View style={[styles.footer, { backgroundColor: colors.header, borderTopColor: colors.accent }]}>
                <TouchableOpacity
                    onPress={handlePrev}
                    disabled={page <= 1 || loading}
                    style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }, (page <= 1 || loading) && styles.disabled]}
                >
                    <Text style={[styles.navText, { color: colors.text }]}>{"< Anterior"}</Text>
                </TouchableOpacity>

                <Text style={[styles.pageIndicator, { color: colors.headerText || '#FFF' }]}>{page}</Text>

                <TouchableOpacity
                    onPress={handleNext}
                    disabled={page >= totalPages || loading}
                    style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }, (page >= totalPages || loading) && styles.disabled]}
                >
                    <Text style={[styles.navText, { color: colors.text }]}>{"Siguiente >"}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#000',
        elevation: 4,
        borderBottomWidth: 2,
        borderBottomColor: '#D32F2F'
    },
    backText: { color: '#DDD', fontSize: 16 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
    reloadButton: { padding: 5 },
    reloadText: { fontSize: 24, color: '#FFF' },
    summary: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2C2C2C', borderBottomWidth: 1, borderColor: '#444' },
    summaryText: { color: '#EEE', fontWeight: 'bold' },
    list: { padding: 10 },
    card: {
        backgroundColor: '#1E1E1E', // Dark Card
        padding: 15,
        marginBottom: 10,
        borderRadius: 8,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#D32F2F'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, borderBottomWidth: 1, borderColor: '#444', paddingBottom: 5 },
    batchId: { fontWeight: 'bold', fontSize: 16, color: '#FFF' },
    date: { color: '#BBB', fontWeight: 'bold' },
    row: { flexDirection: 'row', marginBottom: 5 },
    label: { fontWeight: 'bold', width: 60, color: '#AAA' },
    value: { flex: 1, color: '#E0E0E0' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 },
    actionBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 4, borderWidth: 1 },
    editBtn: { backgroundColor: '#333', borderColor: '#FBC02D' }, // Dark with Yellow border
    deleteBtn: { backgroundColor: '#333', borderColor: '#D32F2F' }, // Dark with Red border
    actionText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#000', elevation: 5, borderTopWidth: 2, borderTopColor: '#D32F2F' },
    navBtn: { padding: 10, backgroundColor: '#333', borderRadius: 4, borderWidth: 1, borderColor: '#555' },
    disabled: { backgroundColor: '#222', opacity: 0.5 },
    navText: { color: 'white', fontWeight: 'bold' },
    pageIndicator: { fontSize: 18, fontWeight: 'bold', color: '#FFF' }
});
