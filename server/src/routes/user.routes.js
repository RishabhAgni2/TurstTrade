import express from 'express';
import {getMe, updateMe, getUserById } from '../controllers/user.controller.js';
import { protect } from '../middlewares.auth.midddleware.js';
import { upload } from '../config/cloudinary.js';


const router = express.Router();
 
router.get('/me',   protect,getMe);
router.put('/me',  protect, upload.single('avatar'),updateMe);
router.get('/:id', getUserById);
 
export default router;