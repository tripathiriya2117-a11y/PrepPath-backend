import mongoose from 'mongoose';

// 1. Define the Subtopic Schema
const subtopicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  depth: { type: String, required: true },
  hours: { type: Number, required: true },
  description: { type: String, required: true },
  isCompleted: { type: Boolean, default: false } // Defaults to incomplete when generated
});

// 2. Define the Module Schema (which embeds the subtopics)
const moduleSchema = new mongoose.Schema({
  moduleName: { type: String, required: true },
  subtopics: [subtopicSchema] // Array of embedded subtopic documents
});

// 3. Define the Main StudyPlan Schema
const studyPlanSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  context: { type: String, default: 'General Understanding' },
  modules: [moduleSchema], // Array of embedded module documents
  createdAt: { type: Date, default: Date.now } // Automatically stamps the creation time
});

// Create and export the model
const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);
export default StudyPlan;