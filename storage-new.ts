import mongoose from 'mongoose';
import {
  MoodEntry,
  AiReflection,
  SpotifyRecommendation,
  SavedPlaylist,
  type IMoodEntry,
  type IAiReflection,
  type ISpotifyRecommendation,
  type ISavedPlaylist
} from './models';
import { ensureDatabaseConnection } from './db';

export interface IStorage {
  // Mood entries
  createMoodEntry(entry: Omit<IMoodEntry, '_id' | 'createdAt'>): Promise<IMoodEntry>;
  getMoodEntry(id: string): Promise<IMoodEntry | null>;
  getAllMoodEntries(): Promise<IMoodEntry[]>;
  getRecentMoodEntries(limit?: number): Promise<IMoodEntry[]>;

  // AI Reflections
  createAiReflection(reflection: Omit<IAiReflection, '_id' | 'createdAt'>): Promise<IAiReflection>;
  getAiReflectionByMoodId(moodEntryId: string): Promise<IAiReflection | null>;

  // Spotify Recommendations
  createSpotifyRecommendations(recommendations: Omit<ISpotifyRecommendation, '_id' | 'createdAt'>[]): Promise<ISpotifyRecommendation[]>;
  getSpotifyRecommendationsByMoodId(moodEntryId: string): Promise<ISpotifyRecommendation[]>;

  // Saved Playlists
  createSavedPlaylist(playlist: Omit<ISavedPlaylist, '_id' | 'createdAt'>): Promise<ISavedPlaylist>;
  getSavedPlaylists(): Promise<ISavedPlaylist[]>;
}

export class MongoStorage implements IStorage {
  private ensureConnection() {
    ensureDatabaseConnection();
  }

  async createMoodEntry(entry: Omit<IMoodEntry, '_id' | 'createdAt'>): Promise<IMoodEntry> {
    this.ensureConnection();
    const moodEntry = new MoodEntry(entry);
    return await moodEntry.save();
  }

  async getMoodEntry(id: string): Promise<IMoodEntry | null> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await MoodEntry.findById(id);
  }

  async getAllMoodEntries(): Promise<IMoodEntry[]> {
    this.ensureConnection();
    return await MoodEntry.find().sort({ createdAt: -1 });
  }

  async getRecentMoodEntries(limit = 10): Promise<IMoodEntry[]> {
    this.ensureConnection();
    return await MoodEntry.find().sort({ createdAt: -1 }).limit(limit);
  }

  async createAiReflection(reflection: Omit<IAiReflection, '_id' | 'createdAt'>): Promise<IAiReflection> {
    this.ensureConnection();
    const aiReflection = new AiReflection(reflection);
    return await aiReflection.save();
  }

  async getAiReflectionByMoodId(moodEntryId: string): Promise<IAiReflection | null> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(moodEntryId)) {
      return null;
    }
    return await AiReflection.findOne({ moodEntryId: new mongoose.Types.ObjectId(moodEntryId) });
  }

  async createSpotifyRecommendations(recommendations: Omit<ISpotifyRecommendation, '_id' | 'createdAt'>[]): Promise<ISpotifyRecommendation[]> {
    this.ensureConnection();
    return await SpotifyRecommendation.insertMany(recommendations);
  }

  async getSpotifyRecommendationsByMoodId(moodEntryId: string): Promise<ISpotifyRecommendation[]> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(moodEntryId)) {
      return [];
    }
    return await SpotifyRecommendation.find({ moodEntryId: new mongoose.Types.ObjectId(moodEntryId) });
  }

  async createSavedPlaylist(playlist: Omit<ISavedPlaylist, '_id' | 'createdAt'>): Promise<ISavedPlaylist> {
    this.ensureConnection();
    const savedPlaylist = new SavedPlaylist(playlist);
    return await savedPlaylist.save();
  }

  async getSavedPlaylists(): Promise<ISavedPlaylist[]> {
    this.ensureConnection();
    return await SavedPlaylist.find().sort({ createdAt: -1 });
  }

  // Additional helper methods
  async getMoodEntryWithReflection(id: string): Promise<{ moodEntry: IMoodEntry; reflection: IAiReflection | null } | null> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    
    const moodEntry = await MoodEntry.findById(id);
    if (!moodEntry) {
      return null;
    }

    const reflection = await AiReflection.findOne({ moodEntryId: new mongoose.Types.ObjectId(id) });
    
    return {
      moodEntry,
      reflection
    };
  }

  async getMoodEntriesWithReflections(): Promise<Array<{ moodEntry: IMoodEntry; reflection: IAiReflection | null }>> {
    this.ensureConnection();
    const moodEntries = await MoodEntry.find().sort({ createdAt: -1 });
    
    const results = [];
    for (const moodEntry of moodEntries) {
      const reflection = await AiReflection.findOne({ moodEntryId: moodEntry._id });
      results.push({
        moodEntry,
        reflection
      });
    }
    
    return results;
  }
}

export const storage = new MongoStorage();
