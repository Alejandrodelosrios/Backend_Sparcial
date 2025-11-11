import express from 'express';
import multer from 'multer';
import AIController from '../controllers/ai.controller.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio and image files
        if (file.fieldname === 'audio') {
            // Accept audio files
            if (file.mimetype.startsWith('audio/')) {
                cb(null, true);
            } else {
                cb(new Error('Solo se permiten archivos de audio'), false);
            }
        } else if (file.fieldname === 'image') {
            // Accept image files
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Solo se permiten archivos de imagen'), false);
            }
        } else {
            cb(new Error('Campo de archivo no válido'), false);
        }
    }
});

// Middleware to handle both JSON and multipart form data
const handleMultipleFormats = (req, res, next) => {
    const contentType = req.get('Content-Type') || '';
    
    if (contentType.includes('multipart/form-data')) {
        // Handle file uploads
        upload.fields([
            { name: 'audio', maxCount: 1 },
            { name: 'image', maxCount: 1 }
        ])(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }
            
            // Determine type based on which file was uploaded
            if (req.files && req.files.audio) {
                req.body.type = 'voice';
            } else if (req.files && req.files.image) {
                req.body.type = 'image';
            }
            
            next();
        });
    } else {
        // Handle JSON data
        next();
    }
};

// Routes principales
router.post('/generate-diagram', handleMultipleFormats, AIController.generateDiagram);
router.get('/features', AIController.getAIFeatures);

// Rutas para gestión de historial de conversación
router.get('/history/:salaId', AIController.getHistory);
router.delete('/history/:salaId', AIController.clearHistoryEndpoint);

// Ruta para obtener el estado del historial (útil para debug)
router.get('/history/:salaId/status', (req, res) => {
    try {
        const { salaId } = req.params;
        const history = AIController.getConversationHistory(salaId);
        
        res.json({
            success: true,
            salaId: salaId,
            messageCount: history.length,
            hasHistory: history.length > 0,
            lastUpdate: history.length > 0 ? new Date().toISOString() : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check for AI service
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'AI Service is running',
        features: {
            textToUML: true,
            voiceToUML: true,
            imageToUML: true,
            conversationMemory: true
        },
        timestamp: new Date().toISOString()
    });
});

export default router;
