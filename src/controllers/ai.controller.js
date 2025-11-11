import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// iiinicializa el client de Gemini AI
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'your_gemini_api_key_here'
});

// In-memory inicia la memoria de las conversaciones
const conversationHistories = new Map();

const SYSTEM_PROMPT = `Eres un experto en diagramas UML de clases. Tu tarea es generar diagramas de clases UML válidos basados en la entrada del usuario.

IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido que represente el diagrama UML, sin texto adicional, sin explicaciones, sin markdown.

El formato del JSON debe ser exactamente:
{
  "elements": [
    {
      "id": "unique_id",
      "type": "class",
      "x": 100,
      "y": 100,
      "selected": false,
      "name": "ClassName",
      "attributes": [
        {
          "name": "attributeName",
          "type": "dataType",
          "visibility": "public|private|protected",
          "isPrimaryKey": false
        }
      ],
      "methods": [
        {
          "name": "methodName",
          "returnType": "returnType",
          "parameters": [
            {
              "name": "paramName",
              "type": "paramType"
            }
          ],
          "visibility": "public|private|protected"
        }
      ],
      "stereotype": "",
      "visibility": "public|private|protected",
      "connections": []
    }
  ],
  "connections": [
    {
      "id": "conn_unique_id",
      "source": "source_class_id",
      "target": "target_class_id",
      "type": "inheritance|composition|aggregation|association",
      "sourceMultiplicity": "0..1|1..*|1|*",
      "targetMultiplicity": "0..1|1..*|1|*",
      "label": "",
      "markerOrientation": "start|none"
    }
  ]
}

Reglas:
1. Los IDs deben ser únicos
2. Las posiciones deben distribuirse de manera lógica (separación mínima de 200px)
3. Los tipos de datos comunes: string, int, boolean, Date, etc.
4. Visibilidades: public (+), private (-), protected (#)
5. Tipos de relaciones: inheritance, composition, aggregation, association
6. Las cardinalidades estándar: "1:1", "1:*", "*:1", "*:*"
7. NUNCA incluyas texto explicativo, solo el JSON válido
8. Recuerda el contexto de conversaciones anteriores y modifica los diagramas según las peticiones del usuario`;

class AIController {
    static getConversationHistory(salaId) {
        if (!conversationHistories.has(salaId)) {
            conversationHistories.set(salaId, []);
        }
        return conversationHistories.get(salaId);
    }

    static addToHistory(salaId, role, content) {
        const history = AIController.getConversationHistory(salaId);
        history.push({
            role: role,
            parts: [{ text: content }]
        });

        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }

        conversationHistories.set(salaId, history);
    }

    static clearHistory(salaId) {
        conversationHistories.delete(salaId);
        return { success: true, message: 'Historial limpiado' };
    }

    static async generateDiagram(req, res) {
        try {
            const { type, content, salaId } = req.body;
            let userInput = '';
            let responseMessage = '';

            console.log('🤖 AI Request:', { type, salaId, hasContent: !!content });

            if (!salaId) {
                throw new Error('salaId es requerido para mantener el contexto de la conversación');
            }

            if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
                const demoDiagram = {
                    elements: [
                        {
                            id: "class1",
                            type: "class",
                            name: "Usuario",
                            attributes: [
                                { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                                { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false }
                            ],
                            methods: [
                                { name: "getNombre", returnType: "string", parameters: [], visibility: "public" }
                            ],
                            position: { x: 100, y: 100 }
                        }
                    ],
                    connections: []
                };

                return res.json({
                    success: true,
                    message: '⚠️ Demo: Configura tu clave de Gemini.',
                    diagram: demoDiagram,
                    originalInput: content || 'Demo input'
                });
            }

            switch (type) {
                case 'text':
                    userInput = content;
                    responseMessage = 'Diagrama generado desde texto';
                    break;

                case 'voice':
                    if (req.files && req.files.audio) {
                        userInput = await AIController.transcribeAudio(req.files.audio[0]);
                        responseMessage = `Diagrama generado desde audio: "${userInput}"`;
                    } else {
                        throw new Error('No se encontró archivo de audio');
                    }
                    break;

                case 'image':
                    if (req.files && req.files.image) {
                        userInput = await AIController.analyzeImage(req.files.image[0]);
                        responseMessage = `Diagrama generado desde imagen`;
                    } else {
                        throw new Error('No se encontró archivo de imagen');
                    }
                    break;

                default:
                    throw new Error('Tipo de entrada no válido');
            }

            if (!userInput) {
                throw new Error('No se pudo procesar la entrada');
            }

            const diagram = await AIController.generateUMLFromText(userInput, salaId);

            res.json({
                success: true,
                message: responseMessage,
                diagram: diagram,
                originalInput: userInput,
                conversationLength: AIController.getConversationHistory(salaId).length
            });

        } catch (error) {
            console.error('❌ Error en AI Controller:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error interno del servidor'
            });
        }
    }

    static async generateUMLFromText(userInput, salaId) {
        try {
            const history = AIController.getConversationHistory(salaId);

            const contents = [
                {
                    role: "user",
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                {
                    role: "model",
                    parts: [{ text: "Entendido. Generaré diagramas UML en formato JSON según tus especificaciones." }]
                },
                ...history,
                {
                    role: "user",
                    parts: [{ text: `Genera un diagrama UML de clases basado en: ${userInput}` }]
                }
            ];

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: contents,
                config: {
                    temperature: 0.7,
                    responseMimeType: 'application/json'
                }
            });

            const responseText = response.text.trim();
            console.log('✅ Respuesta de Gemini:', responseText);

            AIController.addToHistory(salaId, "user", `Genera un diagrama UML de clases basado en: ${userInput}`);
            AIController.addToHistory(salaId, "model", responseText);

            let diagram;
            try {
                diagram = JSON.parse(responseText);
            } catch (parseError) {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    diagram = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('La respuesta de AI no contiene JSON válido');
                }
            }

            AIController.validateDiagramStructure(diagram);
            return diagram;

        } catch (error) {
            console.error('Error generando diagrama UML:', error);
            throw new Error(`Error generando diagrama: ${error.message}`);
        }
    }

    //  Transcribe audio
    static async transcribeAudio(audioFile) {
        const maxRetries = 3;
        const baseDelay = 2000;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const audioBase64 = audioFile.buffer.toString('base64');

                const response = await ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: [
                        {
                            inlineData: {
                                mimeType: audioFile.mimetype,
                                data: audioBase64
                            }
                        },
                        { text: "Transcribe este audio y describe el contenido para crear un diagrama UML de clases. Sé breve." }
                    ]
                });

                return response.text;

            } catch (error) {
                console.error(`Error transcribiendo audio (intento ${attempt + 1}/${maxRetries}):`, error);

                if (error.status === 429 && attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`⏳ Esperando ${delay}ms antes de reintentar...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (error.status === 429) {
                    throw new Error(`Límite de API excedido. Por favor, espera unos minutos.`);
                }
                throw new Error(`Error transcribiendo audio: ${error.message}`);
            }
        }
    }

    // analiza image
    static async analyzeImage(imageFile) {
        try {
            const imageBase64 = imageFile.buffer.toString('base64');

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [
                    {
                        inlineData: {
                            mimeType: imageFile.mimetype,
                            data: imageBase64
                        }
                    },
                    { text: "Analiza esta imagen y describe el sistema, clases, objetos o conceptos que ves para crear un diagrama UML." }
                ]
            });

            return response.text;

        } catch (error) {
            console.error('Error analizando imagen:', error);
            
            if (error.status === 429) {
                throw new Error(`Límite de API excedido. Por favor, espera unos minutos.`);
            }
            throw new Error(`Error analizando imagen: ${error.message}`);
        }
    }

    static validateDiagramStructure(diagram) {
        if (!diagram || typeof diagram !== 'object') {
            throw new Error('Diagrama no es un objeto válido');
        }

        if (!Array.isArray(diagram.elements)) {
            throw new Error('El diagrama debe tener un array de elementos');
        }

        if (!Array.isArray(diagram.connections)) {
            throw new Error('El diagrama debe tener un array de relaciones');
        }

        diagram.elements.forEach((element, index) => {
            if (!element.id || !element.type || !element.name) {
                throw new Error(`Elemento ${index} no tiene id, type o name requeridos`);
            }

            if (!Array.isArray(element.attributes)) {
                element.attributes = [];
            }

            if (!Array.isArray(element.methods)) {
                element.methods = [];
            }

            if (!element.position) {
                element.position = { x: 100 + (index * 200), y: 100 };
            }
        });

        return true;
    }

    static async getHistory(req, res) {
        try {
            const { salaId } = req.params;
            const history = AIController.getConversationHistory(salaId);
            
            res.json({
                success: true,
                salaId: salaId,
                historyLength: history.length,
                history: history
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    static async clearHistoryEndpoint(req, res) {
        try {
            const { salaId } = req.params;
            AIController.clearHistory(salaId);
            
            res.json({
                success: true,
                message: `Historial de la sala ${salaId} limpiado correctamente`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    static async getAIFeatures(req, res) {
        try {
            res.json({
                success: true,
                features: {
                    textToUML: true,
                    voiceToUML: true,
                    imageToUML: true,
                    conversationMemory: true,
                    models: ['gemini-1.5-flash', 'gemini-1.5-pro']
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default AIController;
