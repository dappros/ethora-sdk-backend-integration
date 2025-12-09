/**
 * Express.js integration example
 * 
 * This example shows how to integrate the Ethora SDK with an Express.js application.
 */

import express, { Request, Response } from 'express';
import { getChatRepositoryImpl } from '../src/index';
import axios from 'axios';

const app = express();
app.use(express.json());

const chatRepo = getChatRepositoryImpl();

/**
 * Create a chat room for a workspace
 */
app.post('/workspaces/:workspaceId/chat', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const roomData = req.body; // Additional room configuration

    const response = await chatRepo.createChatRoom(workspaceId, roomData);
    res.json({ success: true, data: response });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: 'Failed to create chat room',
        details: error.response?.data,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Create a user in the chat service
 */
app.post('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userData = req.body; // Additional user data

    const response = await chatRepo.createUser(userId, userData);
    res.json({ success: true, data: response });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: 'Failed to create user',
        details: error.response?.data,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Grant user access to a chat room
 */
app.post(
  '/workspaces/:workspaceId/chat/users/:userId',
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, userId } = req.params;

      await chatRepo.grantUserAccessToChatRoom(workspaceId, userId);
      res.json({ success: true, message: 'Access granted' });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({
          error: 'Failed to grant access',
          details: error.response?.data,
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
);

/**
 * Grant chatbot access to a chat room
 */
app.post('/workspaces/:workspaceId/chat/chatbot', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    await chatRepo.grantChatbotAccessToChatRoom(workspaceId);
    res.json({ success: true, message: 'Chatbot access granted' });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: 'Failed to grant chatbot access',
        details: error.response?.data,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Get client JWT token for a user
 */
app.get('/users/:userId/chat-token', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const token = chatRepo.createChatUserJwtToken(userId);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * Delete a chat room
 */
app.delete('/workspaces/:workspaceId/chat', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const response = await chatRepo.deleteChatRoom(workspaceId);

    if (response.reason === 'Chat room not found') {
      res.status(404).json({ error: 'Chat room not found' });
    } else {
      res.json({ success: true, data: response });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: 'Failed to delete chat room',
        details: error.response?.data,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Delete users
 */
app.delete('/users', async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    const response = await chatRepo.deleteUsers(userIds);
    res.json({ success: true, data: response });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: 'Failed to delete users',
        details: error.response?.data,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Get chat room name (JID)
 */
app.get('/workspaces/:workspaceId/chat/name', (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const full = req.query.full === 'true';

    const chatName = chatRepo.createChatName(workspaceId, full);
    res.json({ chatName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate chat name' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

