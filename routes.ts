import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeMood, generateDailyAffirmation } from "./services/openai";
import { spotifyService } from "./services/spotify";
import { z } from "zod";
import mongoose from 'mongoose';

// Validation schemas
const insertMoodEntrySchema = z.object({
  text: z.string().min(1),
  emoji: z.string().min(1),
  quickMood: z.string().min(1),
  energy: z.number().min(1).max(10),
  valence: z.number().min(1).max(10)
});

const insertSavedPlaylistSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  moodEntryIds: z.array(z.string())
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create mood entry with AI analysis and Spotify recommendations
  app.post("/api/mood-entries", async (req, res) => {
    try {
      const validatedData = insertMoodEntrySchema.parse(req.body);
      
      // Create mood entry
      const moodEntry = await storage.createMoodEntry(validatedData);
      
      // Analyze mood with AI
      const moodAnalysis = await analyzeMood(
        validatedData.text, 
        validatedData.energy, 
        validatedData.valence
      );
      
      // Create AI reflection
      const aiReflection = await storage.createAiReflection({
        moodEntryId: new mongoose.Types.ObjectId(moodEntry._id!.toString()),
        content: moodAnalysis.reflection,
      });
      
      // Get Spotify recommendations
      const spotifyTracks = await spotifyService.getRecommendations(
        moodAnalysis.energy,
        moodAnalysis.valence, 
        moodAnalysis.suggestedGenres
      );
      
      // Get audio features for recommendations
      const trackIds = spotifyTracks.map(track => track.id);
      const audioFeatures = await spotifyService.getAudioFeatures(trackIds);
      
      // Store recommendations
      const recommendations = await storage.createSpotifyRecommendations(
        spotifyTracks.map((track, index) => ({
          moodEntryId: new mongoose.Types.ObjectId(moodEntry._id!.toString()),
          spotifyTrackId: track.id,
          trackName: track.name,
          artistName: track.artists[0]?.name || "Unknown Artist",
          albumImageUrl: track.album.images[0]?.url || null,
          previewUrl: track.preview_url,
          energy: audioFeatures[index]?.energy || 0.5,
          valence: audioFeatures[index]?.valence || 0.5,
        }))
      );
      
      res.json({
        moodEntry,
        aiReflection,
        recommendations,
        analysis: moodAnalysis,
      });
    } catch (error) {
      console.error("Failed to create mood entry:", error);
      res.status(500).json({ 
        message: "Failed to create mood entry and generate recommendations",
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get all mood entries
  app.get("/api/mood-entries", async (req, res) => {
    try {
      const entries = await storage.getAllMoodEntries();
      res.json(entries);
    } catch (error) {
      console.error("Failed to get mood entries:", error);
      res.status(500).json({ message: "Failed to retrieve mood entries" });
    }
  });

  // Get recent mood entries
  app.get("/api/mood-entries/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const entries = await storage.getRecentMoodEntries(limit);
      res.json(entries);
    } catch (error) {
      console.error("Failed to get recent mood entries:", error);
      res.status(500).json({ message: "Failed to retrieve recent mood entries" });
    }
  });

  // Get mood entry with full details
  app.get("/api/mood-entries/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid mood entry ID" });
      }
      
      const entry = await storage.getMoodEntryWithReflection(id);
      
      if (!entry) {
        return res.status(404).json({ message: "Mood entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      console.error("Failed to get mood entry:", error);
      res.status(500).json({ message: "Failed to retrieve mood entry" });
    }
  });

  // Get recommendations for a mood entry
  app.get("/api/mood-entries/:id/recommendations", async (req, res) => {
    try {
      const moodEntryId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(moodEntryId)) {
        return res.status(400).json({ message: "Invalid mood entry ID" });
      }
      
      const recommendations = await storage.getSpotifyRecommendationsByMoodId(moodEntryId);
      res.json(recommendations);
    } catch (error) {
      console.error("Failed to get recommendations:", error);
      res.status(500).json({ message: "Failed to retrieve recommendations" });
    }
  });

  // Refresh recommendations for a mood entry
  app.post("/api/mood-entries/:id/refresh-recommendations", async (req, res) => {
    try {
      const moodEntryId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(moodEntryId)) {
        return res.status(400).json({ message: "Invalid mood entry ID" });
      }
      
      const moodEntry = await storage.getMoodEntry(moodEntryId);
      
      if (!moodEntry) {
        return res.status(404).json({ message: "Mood entry not found" });
      }

      // Get new recommendations
      const spotifyTracks = await spotifyService.getRecommendations(
        moodEntry.energy,
        moodEntry.valence
      );
      
      const trackIds = spotifyTracks.map(track => track.id);
      const audioFeatures = await spotifyService.getAudioFeatures(trackIds);
      
      const recommendations = await storage.createSpotifyRecommendations(
        spotifyTracks.map((track, index) => ({
          moodEntryId: new mongoose.Types.ObjectId(moodEntry._id!.toString()),
          spotifyTrackId: track.id,
          trackName: track.name,
          artistName: track.artists[0]?.name || "Unknown Artist",
          albumImageUrl: track.album.images[0]?.url || null,
          previewUrl: track.preview_url,
          energy: audioFeatures[index]?.energy || 0.5,
          valence: audioFeatures[index]?.valence || 0.5,
        }))
      );
      
      res.json(recommendations);
    } catch (error) {
      console.error("Failed to refresh recommendations:", error);
      res.status(500).json({ message: "Failed to refresh recommendations" });
    }
  });

  // Save playlist to Spotify (mock implementation)
  app.post("/api/playlists/save", async (req, res) => {
    try {
      const validatedData = insertSavedPlaylistSchema.parse(req.body);
      const playlistData = {
        ...validatedData,
        moodEntryIds: validatedData.moodEntryIds.map(id => new mongoose.Types.ObjectId(id))
      };
      const savedPlaylist = await storage.createSavedPlaylist(playlistData);
      res.json(savedPlaylist);
    } catch (error) {
      console.error("Failed to save playlist:", error);
      res.status(500).json({ message: "Failed to save playlist" });
    }
  });

  // Get saved playlists
  app.get("/api/playlists", async (req, res) => {
    try {
      const playlists = await storage.getSavedPlaylists();
      res.json(playlists);
    } catch (error) {
      console.error("Failed to get playlists:", error);
      res.status(500).json({ message: "Failed to retrieve playlists" });
    }
  });

  // Get daily affirmation
  app.get("/api/affirmation", async (req, res) => {
    try {
      const recentEntries = await storage.getRecentMoodEntries(5);
      const recentMoods = recentEntries.map(entry => entry.text.slice(0, 50));
      const affirmation = await generateDailyAffirmation(recentMoods);
      res.json({ affirmation });
    } catch (error) {
      console.error("Failed to generate affirmation:", error);
      res.status(500).json({ message: "Failed to generate affirmation" });
    }
  });

  // Search Spotify tracks
  app.get("/api/spotify/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const tracks = await spotifyService.searchTracks(query, limit);
      res.json(tracks);
    } catch (error) {
      console.error("Failed to search tracks:", error);
      res.status(500).json({ message: "Failed to search tracks" });
    }
  });

  // Get available Spotify genres
  app.get("/api/spotify/genres", async (req, res) => {
    try {
      const genres = await spotifyService.getAvailableGenres();
      res.json(genres);
    } catch (error) {
      console.error("Failed to get genres:", error);
      res.status(500).json({ message: "Failed to retrieve genres" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
