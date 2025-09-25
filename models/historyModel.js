import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },

  // Medical Conditions
  hayFever: String,
  hayFeverDuration: Number,
  asthma: String,
  asthmaDuration: Number,
  breathingProblems: String,
  breathingProblemsDuration: Number,
  hivesSwelling: String,
  hivesSwellingDuration: Number,
  sinusTrouble: String,
  sinusTroubleDuration: Number,
  eczemaRashes: String,
  eczemaRashesDuration: Number,
  foodAllergies: String,
  foodAllergiesDuration: Number,
  arthriticDiseases: String,
  arthriticDiseasesDuration: Number,
  immuneDefect: String,
  immuneDefectDuration: Number,
  drugAllergy: String,
  drugAllergyDuration: Number,
  beeStingHypersensitivity: String,
  beeStingHypersensitivityDuration: Number,
  
  // Hay Fever Details
  feverGrade: String,
  itchingSoreThroat: String,
  specificDayExposure: String,
  
  // Asthma Details
  asthmaType: String,
  exacerbationsFrequency: String,
  
  // Medical Events
  hospitalAdmission: String,
  hospitalAdmissionDuration: Number,
  gpAttendances: String,
  gpAttendancesDuration: Number,
  aeAttendances: String,
  aeAttendancesDuration: Number,
  ituAdmissions: String,
  ituAdmissionsDuration: Number,
  coughWheezeFrequency: String,
  coughWheezeDuration: Number,
  intervalSymptoms: String,
  intervalSymptomsDuration: Number,
  nightCoughFrequency: String,
  nightCoughDuration: Number,
  earlyMorningCough: String,
  earlyMorningCoughDuration: Number,
  exerciseInducedSymptoms: String,
  exerciseInducedSymptomsDuration: Number,
  familySmoking: String,
  familySmokingDuration: Number,
  petsAtHome: String,
  petsAtHomeDuration: Number,
    
  // Triggers
  triggersUrtis: Boolean,
  triggersColdWeather: Boolean,
  triggersPollen: Boolean,
  triggersSmoke: Boolean,
  triggersExercise: Boolean,
  triggersPets: Boolean,
  triggersOthers: String,
  
  // Allergic Rhinitis
  allergicRhinitisType: String,
  rhinitisSneezing: String,
  rhinitisNasalCongestion: String,
  rhinitisRunningNose: String,
  rhinitisItchingNose: String,
  rhinitisItchingEyes: String,
  rhinitisCoughing: String,
  rhinitisWheezing: String,
  rhinitisCoughingWheezing: String,
  rhinitisWithExercise: String,
  rhinitisHeadaches: String,
  rhinitisPostNasalDrip: String,
  
  // Skin Allergy
  skinAllergyType: String,
  skinHeavesPresent: String,
  skinHeavesDuration: Number,
  skinHeavesDistribution: String,
  skinEczemaPresent: String,
  skinEczemaDuration: Number,
  skinEczemaDistribution: String,
  skinUlcerPresent: String,
  skinUlcerDuration: Number,
  skinUlcerDistribution: String,
  skinPapuloSquamousRashesPresent: String,
  skinPapuloSquamousRashesDuration: Number,
  skinPapuloSquamousRashesDistribution: String,
  skinItchingNoRashesPresent: String,
  skinItchingNoRashesDuration: Number,
  skinItchingNoRashesDistribution: String,
  
  // Medical History
  hypertension: String,
  hypertensionDuration: Number,
  diabetes: String,
  diabetesDuration: Number,
  epilepsy: String,
  epilepsyDuration: Number,
  ihd: String,
  ihdDuration: Number,
  
  // New Drugs
  drugAllergyKnown: String,
  probable: String,
  definite: String,
  
  // Occupation and Exposure
  occupation: String,
  probableChemicalExposure: String,
  location: String,
  familyHistory: String,
  
  // Examination
  oralCavity: String,
  skin: String,
  ent: String,
  eye: String,
  respiratorySystem: String,
  cvs: String,
  cns: String,
  abdomen: String,
  otherFindings: String,
  
  // Report File
  reportFile: String

}, { timestamps: true });

const History = mongoose.model("History", historySchema);
export default History;
