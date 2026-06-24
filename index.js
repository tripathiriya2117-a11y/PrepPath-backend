import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Load env variables immediately
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 2. Define Mongoose Schema and Model
const studyPlanSchema = new mongoose.Schema({
  topic: String,
  context: String,
  modules: Array,
  createdAt: { type: Date, default: Date.now }
});
const StudyPlan = mongoose.models.StudyPlan || mongoose.model('StudyPlan', studyPlanSchema);

// 3. Initialize Gemini SDK
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 4. API ROUTES

// --- A. Generate Path Route (Strict JSON) ---
app.post('/api/generate-path', async (req, res) => {
  try {
    const { topic, context } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
Create a structured study roadmap for learning: ${topic}. 
Context about the learner: ${context || 'Beginner'}.

You MUST respond strictly with a valid JSON object matching this exact structural schema (no markdown blocks, no triple backticks):
{
  "topic": "${topic}",
  "context": "${context}",
  "modules": [
    {
      "moduleName": "String (e.g., Module 1: Foundational Math)",
      "subtopics": [
        {
          "name": "String (e.g., Linear Algebra)",
          "depth": "String (e.g., Core / Practical / Advanced)",
          "hours": Number (e.g., 4),
          "description": "String (e.g., Master vector operations and dot products)",
          "isCompleted": false
        }
      ]
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Clean up any accidental markdown backticks the AI might have included
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    // Parse the structural response text safely
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Malformed AI response text:", responseText);
      return res.status(500).json({ error: "AI response formatting mismatch. Please try again." });
    }

    const newPlan = new StudyPlan({
      topic: parsedData.topic || topic,
      context: parsedData.context || context || 'General',
      modules: parsedData.modules || []
    });

    const savedPlan = await newPlan.save();
    return res.json(savedPlan);

  } catch (error) {
    console.error('Error generating path:', error);
    return res.status(500).json({ error: 'Failed to generate study path' });
  }
});

// --- B. Get All Paths Route ---
app.get('/api/paths', async (req, res) => {
  try {
    const histories = await StudyPlan.find().sort({ createdAt: -1 });
    return res.json(histories);
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// --- C. Update Subtopic Completion Status Route ---
// Change the parameter name from :subtopicId to :subtopicName
app.patch('/api/paths/:planId/subtopics/:subtopicName', async (req, res) => {
  try {
    const { planId, subtopicName } = req.params;
    const { isCompleted } = req.body;

    // Find document by ID and match the subtopic inside the array by its name field
    const updatedPlan = await StudyPlan.findOneAndUpdate(
      { _id: planId, "modules.subtopics.name": subtopicName },
      { $set: { "modules.$.subtopics.$[subtopic].isCompleted": isCompleted } },
      { 
        arrayFilters: [{ "subtopic.name": subtopicName }],
        returnDocument: 'after'  
      }
    );

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Study plan or subtopic name not found' });
    }

    return res.json(updatedPlan);
  } catch (error) {
    console.error('Error updating subtopic:', error);
    return res.status(500).json({ error: 'Failed to update subtopic' });
  }
});

// 5. Connect to MongoDB and start the server
console.log('🔄 Attempting to connect to MongoDB...');

mongoose.connect('mongodb://tripathiriya2117_db_user:r2i1y0a12006@ac-wxmtjzd-shard-00-00.imbwvfb.mongodb.net:27017,ac-wxmtjzd-shard-00-01.imbwvfb.mongodb.net:27017,ac-wxmtjzd-shard-00-02.imbwvfb.mongodb.net:27017/preppath?ssl=true&replicaSet=atlas-hxmtu1-shard-0&authSource=admin&appName=Riya', {
  serverSelectionTimeoutMS: 5000, 
})
.then(() => {
  console.log('💾 MongoDB Connected Successfully!');
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server safely running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('❌ CRITICAL: MongoDB completely failed to connect at startup:');
  console.error(err.message);
});