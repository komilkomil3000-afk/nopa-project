"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemSetting = getSystemSetting;
exports.setSystemSetting = setSystemSetting;
const db_1 = __importDefault(require("../config/db"));
const adminController_1 = require("./adminController");
async function getSystemSetting(req, res) {
    try {
        const { key } = req.params;
        const setting = await db_1.default.systemSetting.findUnique({ where: { key } });
        res.json({ key, value: setting?.value || null });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function setSystemSetting(req, res) {
    try {
        const { key } = req.params;
        const { value } = req.body;
        if (!value)
            return res.status(400).json({ error: 'Value is required' });
        const setting = await db_1.default.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'SET_SYSTEM_SETTING', 'SystemSetting', key, `Set ${key} to ${value}`, req.ip || '');
        res.json({ success: true, setting });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
