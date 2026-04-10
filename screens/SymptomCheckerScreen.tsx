import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';

const AVAILABLE_SYMPTOMS = [
  'itching',
  'skin_rash',
  'continuous_sneezing',
  'shivering',
  'stomach_pain',
  'acidity',
  'vomiting',
  'indigestion',
  'muscle_wasting',
  'patches_in_throat',
  'fatigue',
  'weight_loss',
  'sunken_eyes',
  'cough',
  'headache',
  'chest_pain',
  'back_pain',
  'weakness_in_limbs',
  'chills',
  'joint_pain',
  'yellowish_skin',
  'constipation',
  'pain_during_bowel_movements',
  'breathlessness',
  'cramps',
  'weight_gain',
  'mood_swings',
  'neck_pain',
  'muscle_weakness',
  'stiff_neck',
  'pus_filled_pimples',
  'burning_micturition',
  'bladder_discomfort',
  'high_fever',
  'nodal_skin_eruptions',
  'ulcers_on_tongue',
  'loss_of_appetite',
  'restlessness',
  'dehydration',
  'dizziness',
  'weakness_of_one_body_side',
  'lethargy',
  'nausea',
  'abdominal_pain',
  'pain_in_anal_region',
  'sweating',
  'bruising',
  'cold_hands_and_feets',
  'anxiety',
  'knee_pain',
  'swelling_joints',
  'blackheads',
  'foul_smell_of urine',
  'skin_peeling',
  'blister',
  'dischromic _patches',
  'watering_from_eyes',
  'extra_marital_contacts',
  'diarrhoea',
  'loss_of_balance',
  'blurred_and_distorted_vision',
  'altered_sensorium',
  'dark_urine',
  'swelling_of_stomach',
  'bloody_stool',
  'obesity',
  'hip_joint_pain',
  'movement_stiffness',
  'spinning_movements',
  'scurring',
  'continuous_feel_of_urine',
  'silver_like_dusting',
  'red_sore_around_nose',
  'spotting_ urination',
  'passage_of_gases',
  'irregular_sugar_level',
  'family_history',
  'lack_of_concentration',
  'excessive_hunger',
  'yellowing_of_eyes',
  'distention_of_abdomen',
  'irritation_in_anus',
  'swollen_legs',
  'painful_walking',
  'small_dents_in_nails',
  'yellow_crust_ooze',
  'internal_itching',
  'mucoid_sputum',
  'history_of_alcohol_consumption',
  'swollen_blood_vessels',
  'unsteadiness',
  'inflammatory_nails',
  'depression',
  'fluid_overload',
  'swelled_lymph_nodes',
  'malaise',
  'prominent_veins_on_calf',
  'puffy_face_and_eyes',
  'fast_heart_rate',
  'irritability',
  'muscle_pain',
  'mild_fever',
  'yellow_urine',
  'phlegm',
  'enlarged_thyroid',
  'increased_appetite',
  'visual_disturbances',
  'brittle_nails',
  'drying_and_tingling_lips',
  'polyuria',
  'pain_behind_the_eyes',
  'toxic_look_(typhos)',
  'throat_irritation',
  'swollen_extremeties',
  'slurred_speech',
  'red_spots_over_body',
  'belly_pain',
  'receiving_blood_transfusion',
  'acute_liver_failure',
  'redness_of_eyes',
  'rusty_sputum',
  'abnormal_menstruation',
  'receiving_unsterile_injections',
  'coma',
  'sinus_pressure',
  'palpitations',
  'stomach_bleeding',
  'runny_nose',
  'congestion',
  'blood_in_sputum',
  'loss_of_smell',
];

export function SymptomCheckerScreen(): React.JSX.Element {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);

  // Modal & Search State
  const [isModalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to format 'skin_rash' into 'Skin Rash' for the UI
  const formatSymptomName = (symptom: string) => {
    return symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Filter symptoms for the search bar (excluding ones already selected)
  const filteredSymptoms = AVAILABLE_SYMPTOMS.filter(
    symptom =>
      formatSymptomName(symptom)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) &&
      !selectedSymptoms.includes(symptom),
  );

  const addSymptom = (symptom: string) => {
    setSelectedSymptoms([...selectedSymptoms, symptom]);
    setModalVisible(false);
    setSearchQuery(''); // Reset search for next time
  };

  const removeSymptom = (symptomToRemove: string) => {
    setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptomToRemove));
  };

  const getPrediction = async () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert('Hold on!', 'Please select at least one symptom.');
      return;
    }

    setLoading(true);
    setPrediction(null);

    try {
      const response = await fetch(
        'https://kar71key-disease-prediction.hf.space/predict',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symptoms: selectedSymptoms }),
        },
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      setPrediction(data);
    } catch (error) {
      console.error('API Error:', error);
      Alert.alert('Error', 'Could not connect to the prediction server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Symptom Checker</Text>
      <Text style={styles.subHeader}>Add what you are experiencing:</Text>

      {/* Selected Symptoms Area */}
      <View style={styles.selectedContainer}>
        {selectedSymptoms.map(symptom => (
          <View key={symptom} style={styles.selectedChip}>
            <Text style={styles.selectedChipText}>
              {formatSymptomName(symptom)}
            </Text>
            <TouchableOpacity
              onPress={() => removeSymptom(symptom)}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* The "+" Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Add Symptom</Text>
        </TouchableOpacity>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.predictButton,
          selectedSymptoms.length === 0 && styles.buttonDisabled,
        ]}
        onPress={getPrediction}
        disabled={loading || selectedSymptoms.length === 0}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.predictButtonText}>Check Symptoms</Text>
        )}
      </TouchableOpacity>

      {/* Results Area */}
      {prediction && (
        <ScrollView style={styles.resultCard}>
          <Text style={styles.resultDisease}>
            Disease: {prediction.disease}
          </Text>
          <Text style={styles.resultDescription}>{prediction.description}</Text>

          <Text style={styles.precautionsHeader}>Recommended Precautions:</Text>
          {prediction.precautions.map((item: string, index: number) => (
            <Text key={index} style={styles.precautionItem}>
              • {formatSymptomName(item)}
            </Text>
          ))}
        </ScrollView>
      )}

      {/* Searchable Dropdown Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet" // Gives a nice native pull-up card look on iOS
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Symptoms</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Type to search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />

          <FlatList
            data={filteredSymptoms}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => addSymptom(item)}
              >
                <Text style={styles.listItemText}>
                  {formatSymptomName(item)}
                </Text>
                <Text style={styles.listAddIcon}>+</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No matching symptoms found.</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  subHeader: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 5,
    marginBottom: 20,
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  selectedChip: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#E0E6ED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#34495E',
    fontWeight: '600',
  },
  predictButton: {
    backgroundColor: '#2ECC71',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#95A5A6',
  },
  predictButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 2,
  },
  resultDisease: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 10,
  },
  resultDescription: {
    fontSize: 16,
    color: '#34495E',
    marginBottom: 15,
    lineHeight: 22,
  },
  precautionsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  precautionItem: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  closeModalText: {
    fontSize: 16,
    color: '#3498DB',
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#F0F3F4',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  listItemText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  listAddIcon: {
    fontSize: 20,
    color: '#3498DB',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7F8C8D',
    marginTop: 30,
    fontSize: 16,
  },
});
