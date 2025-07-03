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

// Helper function to transform MongoDB document to include id field for frontend compatibility
const transformMoodEntry = (doc: any) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id.toString()
  };
};

const transformAiReflection = (doc: any) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id.toString()
  };
};

const transformSpotifyRecommendation = (doc: any) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id.toString()
  };
};

const transformSavedPlaylist = (doc: any) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id.toString()
  };
};

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
    const saved = await moodEntry.save();
    return transformMoodEntry(saved);
  }

  async getMoodEntry(id: string): Promise<IMoodEntry | null> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await MoodEntry.findById(id);
    return transformMoodEntry(doc);
  }

  async getAllMoodEntries(): Promise<IMoodEntry[]> {
    this.ensureConnection();
    const docs = await MoodEntry.find().sort({ createdAt: -1 });
    return docs.map(transformMoodEntry);
  }

  async getRecentMoodEntries(limit = 10): Promise<IMoodEntry[]> {
    this.ensureConnection();
    const docs = await MoodEntry.find().sort({ createdAt: -1 }).limit(limit);
    return docs.map(transformMoodEntry);
  }

  async createAiReflection(reflection: Omit<IAiReflection, '_id' | 'createdAt'>): Promise<IAiReflection> {
    this.ensureConnection();
    const aiReflection = new AiReflection(reflection);
    const saved = await aiReflection.save();
    return transformAiReflection(saved);
  }

  async getAiReflectionByMoodId(moodEntryId: string): Promise<IAiReflection | null> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(moodEntryId)) {
      return null;
    }
    const doc = await AiReflection.findOne({ moodEntryId: new mongoose.Types.ObjectId(moodEntryId) });
    return transformAiReflection(doc);
  }

  async createSpotifyRecommendations(recommendations: Omit<ISpotifyRecommendation, '_id' | 'createdAt'>[]): Promise<ISpotifyRecommendation[]> {
    this.ensureConnection();
    const saved = await SpotifyRecommendation.insertMany(recommendations);
    return saved.map(transformSpotifyRecommendation);
  }

  async getSpotifyRecommendationsByMoodId(moodEntryId: string): Promise<ISpotifyRecommendation[]> {
    this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(moodEntryId)) {
      return [];
    }
    const docs = await SpotifyRecommendation.find({ moodEntryId: new mongoose.Types.ObjectId(moodEntryId) });
    return docs.map(transformSpotifyRecommendation);
  }

  async createSavedPlaylist(playlist: Omit<ISavedPlaylist, '_id' | 'createdAt'>): Promise<ISavedPlaylist> {
    this.ensureConnection();
    const savedPlaylist = new SavedPlaylist(playlist);
    const saved = await savedPlaylist.save();
    return transformSavedPlaylist(saved);
  }

  async getSavedPlaylists(): Promise<ISavedPlaylist[]> {
    this.ensureConnection();
    const docs = await SavedPlaylist.find().sort({ createdAt: -1 });
    return docs.map(transformSavedPlaylist);
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
      moodEntry: transformMoodEntry(moodEntry),
      reflection: transformAiReflection(reflection)
    };
  }

  async getMoodEntriesWithReflections(): Promise<Array<{ moodEntry: IMoodEntry; reflection: IAiReflection | null }>> {
    this.ensureConnection();
    const moodEntries = await MoodEntry.find().sort({ createdAt: -1 });
    
    const results = [];
    for (const moodEntry of moodEntries) {
      const reflection = await AiReflection.findOne({ moodEntryId: moodEntry._id });
      results.push({
        moodEntry: transformMoodEntry(moodEntry),
        reflection: transformAiReflection(reflection)
      });
    }
    
    return results;
  }
}

export const storage = new MongoStorage();
