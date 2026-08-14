"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuizMock = createQuizMock;
async function createQuizMock(req, res) {
    try {
        const { title, rewardZarik, passScore } = req.body;
        // Mock success response as per Phase 1 requirements
        // Real quiz engine to be developed in Phase 3
        res.status(201).json({
            success: true,
            message: 'آزمون با موفقیت ثبت شد (نسخه اولیه)',
            data: {
                id: 'mock-quiz-' + Date.now(),
                title,
                rewardZarik,
                passScore,
                createdAt: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
