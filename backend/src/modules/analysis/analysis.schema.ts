
export const AnalysisResponseSchema = {
    "title": "AnalysisResponse",
    "type": "object",
    "additionalProperties": true,
    "required": ["tierMode", "baseline", "optimizations"],
    "properties": {
        "tierMode": {
            "type": "string",
            "enum": ["TIER0", "TIER1"]
        },
        "baseline": {
            "type": "object",
            "additionalProperties": true,
            "required": ["confidence", "totalRuntimeSeconds", "topBottlenecks"],
            "properties": {
                "confidence": {
                    "type": "string",
                    "enum": ["measured", "approximate", "insufficient"]
                },
                "totalRuntimeSeconds": {
                    "type": ["number", "null"],
                    "minimum": 0
                },
                "topBottlenecks": {
                    "type": "array",
                    "items": { "type": "string", "minLength": 1 },
                    "maxItems": 20
                }
            }
        },
        "optimizations": {
            "type": "array",
            "minItems": 0,
            "items": {
                "type": "object",
                "additionalProperties": true,
                "required": [
                    "title",
                    "severity",
                    "description",
                    "impactLevel",
                    "timeSavings"
                ],
                "properties": {
                    "title": { "type": "string", "minLength": 1, "maxLength": 140 },
                    "severity": {
                        "type": "string",
                        "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
                    },
                    "description": { "type": "string", "minLength": 1, "maxLength": 5000 },
                    "impactLevel": {
                        "type": "string",
                        "enum": ["Very High", "High", "Medium", "Low"]
                    },
                    "affectedStageIds": {
                        "type": "array",
                        "items": { "type": ["string", "number"] },
                        "maxItems": 50
                    },
                    "timeSavings": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                            "estimatedSecondsSaved",
                            "estimatedPercentSaved",
                            "estimateBasis",
                            "confidence",
                            "evidenceStageIds"
                        ],
                        "properties": {
                            "estimatedSecondsSaved": { "type": ["number", "null"], "minimum": 0 },
                            "estimatedPercentSaved": { "type": ["number", "null"], "minimum": 0, "maximum": 1 },
                            "estimateBasis": {
                                "type": ["string", "null"],
                                "enum": ["measured_baseline", null]
                            },
                            "confidence": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
                            "evidenceStageIds": {
                                "type": "array",
                                "items": { "type": "integer", "minimum": 0 },
                                "maxItems": 50
                            }
                        }
                    }
                }
            }
        }
    }
};
