import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Subdocument schemas
// ---------------------------------------------------------------------------

const answerSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    transcript: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    analysis: {
        relevance: { type: Number, default: null, min: 0, max: 100 },
        clarity: { type: Number, default: null, min: 0, max: 100 },
        confidence: { type: Number, default: null, min: 0, max: 100 },
        feedback: { type: String, default: '' },
        suggestions: [String],
        fillerWords: {
            count: { type: Number, default: 0 },
            words: [String]
        },
        whatYouDidWell: [String],
        whatWasMissing: [String],
        idealAnswer: { type: String, default: '' },
        keyTakeaway: { type: String, default: '' },
        communicationStyle: {
            pace: { type: String, default: '' },
            structure: { type: String, default: '' },
            specificity: { type: String, default: '' }
        },
        // v2 — present only for coding-mode answers
        codeAnalysis: {
            passedTests: { type: Number, default: 0 },
            totalTests: { type: Number, default: 0 },
            timeComplexity: { type: String, default: '' },
            spaceComplexity: { type: String, default: '' },
            codeQuality: { type: Number, default: null, min: 0, max: 100 },
            bugs: [String]
        }
    },
    expressionMetrics: {
        averageConfidence: { type: Number, default: null },
        eyeContactPercentage: { type: Number, default: null },
        headMovementStability: { type: Number, default: null },
        overallExpressionScore: { type: Number, default: null, min: 0, max: 100 }
    },
    submittedAt: { type: Date, default: Date.now },
    observations: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // v2 additions
    code: { type: String, default: '' },
    audioUrl: { type: String, default: '' },
    annotations: [{
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }]
});

const codingQuestionSchema = new mongoose.Schema({
    language: { type: String, default: 'javascript' },
    problemStatement: { type: String, default: '' },
    starterCode: { type: String, default: '' },
    constraints: { type: String, default: '' },
    testCases: [{
        input: { type: String, default: '' },
        expected: { type: String, default: '' },
        hidden: { type: Boolean, default: false }
    }],
    idealSolution: { type: String, default: '' },
    timeComplexity: { type: String, default: '' },
    spaceComplexity: { type: String, default: '' }
}, { _id: false });

const interviewSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true, alias: 'odId' },
    purpose: { type: String, enum: ['interview', 'discovery'] },
    scoreVersion: String,
    scoring: { type: mongoose.Schema.Types.Mixed, default: undefined },
    discovery: { type: mongoose.Schema.Types.Mixed, default: undefined },
    confirmationPending: { type: Boolean, default: false },
    generation: {
        kind: String, status: String, token: String, leaseUntil: Date,
        answerCount: Number, errorCode: String
    },
    jobRole: { type: String, required: true },
    title: { type: String, default: '', trim: true, maxlength: 40 },
    industry: { type: String, required: true },
    experienceLevel: { type: String, required: true },
    mode: {
        type: String,
        enum: ['behavioral', 'technical', 'coding', 'mixed'],
        default: 'behavioral'
    },
    language: { type: String, default: 'en' },
    companyName: { type: String, default: '' },
    companyRole: { type: String, default: '' },
    questions: [{
        questionId: String,
        question: String,
        type: { type: String, lowercase: true, trim: true, default: 'general' },
        difficulty: { type: String, lowercase: true, trim: true, default: 'medium' },
        // v2 — coding questions only
        coding: { type: codingQuestionSchema, default: null }
    }],
    answers: [answerSchema],
    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
    totalQuestionCount: { type: Number, default: 10 },
    contextSummary: { type: String, default: '' },
    overallScore: { type: Number, default: null },
    overallFeedback: {
        summary: String,
        topStrengths: [String],
        areasToImprove: [String],
        recommendations: [String],
        expressionAnalysis: {
            overallConfidence: { type: Number, default: null },
            feedback: String
        }
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    duration: { type: Number, default: 0 },

    // v2 additions
    jobDescriptionText: { type: String, default: '' },
    resumeText: { type: String, default: '' },
    warmupCompleted: { type: Boolean, default: false },
    providerHistory: [{
        provider: { type: String, default: '' },
        model: { type: String, default: '' },
        action: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });
interviewSchema.pre(/^find/, function mapOwnerAlias() {
  const query = this.getQuery();
  if (query && Object.prototype.hasOwnProperty.call(query, 'odId') && !Object.prototype.hasOwnProperty.call(query, 'userId')) {
    query.userId = query.odId;
    delete query.odId;
  }
});
interviewSchema.index({ userId: 1, createdAt: -1 }, { background: true });
interviewSchema.index({ userId: 1, status: 1 }, { background: true });
interviewSchema.index({ userId: 1, jobRole: 1, industry: 1 }, { background: true });
interviewSchema.index({ userId: 1, overallScore: -1 }, { background: true });
interviewSchema.index({ userId: 1, status: 1, completedAt: -1 }, { background: true });
interviewSchema.index({ userId: 1, experienceLevel: 1, createdAt: -1 }, { background: true });
interviewSchema.index({ companyName: 1, companyRole: 1 }, { background: true, sparse: true });

export default mongoose.model('Interview', interviewSchema);
