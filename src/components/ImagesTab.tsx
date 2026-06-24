import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Trash2, Maximize2, Download, Image as ImageIcon, 
  Eye, FileText, Lock, Calendar, AlertTriangle, ArrowLeft, FolderPlus,
  Loader2, Filter, Star
} from 'lucide-react';
import { VaultImage } from '../types';
import { getAllFromStore, addToStore, updateInStore, deleteFromStore } from '../lib/db';

interface ImagesTabProps {
  onNotify: (message: string, type: 'success' | 'error') => void;
  searchTerm: string;
}

const CATEGORIES = ['All', 'Private', 'ID Cards', 'Documents', 'Memories'];

export default function ImagesTab({ onNotify, searchTerm }: ImagesTabProps) {
  const [images, setImages] = useState<VaultImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<VaultImage[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  
  // States
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<VaultImage | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Private');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  useEffect(() => {
    filterAndSearchImages();
  }, [images, activeCategory, searchTerm]);

  const loadImages = async () => {
    try {
      const data = await getAllFromStore<VaultImage>('images');
      setImages(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      onNotify('Failed to fetch images', 'error');
    }
  };

  const filterAndSearchImages = () => {
    let result = [...images];

    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter(img => img.category === activeCategory);
    }

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(img => img.title.toLowerCase().includes(term));
    }

    setFilteredImages(result);
  };

  // Canvas Image Compression Helper (extremely optimized for fast offline database performance)
  const compressAndProcessImage = (file: File): Promise<Omit<VaultImage, 'id'>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200; // Limit high resolutions to 1200px max
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context failed'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress quality to 0.75 for amazing size reductions with flawless visual clarity
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          
          resolve({
            title: file.name.split('.')[0] || 'Vault Image',
            category: selectedCategory,
            base64: compressedBase64,
            size: Math.round(compressedBase64.length * 0.75), // rough byte size
            favorite: false,
            timestamp: Date.now()
          });
        };
        img.onerror = () => reject(new Error('Failed to load image file'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleFiles = async (files: FileList) => {
    setIsUploading(true);
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        onNotify(`Skipped non-image file: ${file.name}`, 'error');
        continue;
      }

      try {
        const processed = await compressAndProcessImage(file);
        await addToStore('images', processed);
        successCount++;
      } catch (err) {
        onNotify(`Error processing ${file.name}`, 'error');
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      onNotify(`Securely imported ${successCount} image(s)`, 'success');
      loadImages();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const selectFilesViaDialog = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const deleteImage = async (id: number) => {
    if (!window.confirm('Delete this secure image permanently?')) return;
    try {
      await deleteFromStore('images', id);
      onNotify('Image deleted', 'success');
      setSelectedImage(null);
      loadImages();
    } catch (err) {
      onNotify('Failed to delete image', 'error');
    }
  };

  const toggleFavorite = async (img: VaultImage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = { ...img, favorite: !img.favorite };
      await updateInStore('images', updated);
      onNotify(updated.favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
      if (selectedImage?.id === img.id) {
        setSelectedImage(updated);
      }
      loadImages();
    } catch (err) {
      onNotify('Failed to update favorite', 'error');
    }
  };

  const saveDetails = async () => {
    if (!selectedImage) return;
    try {
      const updated = {
        ...selectedImage,
        title: customTitle || 'Vault Image',
        category: selectedCategory
      };
      await updateInStore('images', updated);
      onNotify('Metadata updated successfully', 'success');
      setSelectedImage(updated);
      loadImages();
    } catch (err) {
      onNotify('Failed to update details', 'error');
    }
  };

  const triggerDownload = (img: VaultImage) => {
    const link = document.createElement('a');
    link.href = img.base64;
    link.download = `${img.title}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Image exported to downloads', 'success');
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div id="images-tab-root" className="w-full flex-1 flex flex-col">
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeCategory === cat
                ? 'bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] text-white shadow-[0_2px_10px_rgba(123,47,247,0.4)]'
                : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-purple-900/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto pb-24 flex flex-col gap-4">
        {/* Safe Drop-Zone and Quick Uploader */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          {/* Section Selector for new uploads */}
          <div className="bg-[#1A1A1A] border border-purple-950/20 rounded-2xl p-4 flex flex-col justify-between gap-3 md:w-56">
            <div>
              <h4 className="text-xs font-bold text-[#C77DFF] tracking-wider uppercase mb-1">Upload Section</h4>
              <p className="text-[11px] text-gray-400">Select where uploaded images will be filed.</p>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-purple-900/30 text-gray-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-[#7B2FF7]"
            >
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Secure drag and drop region */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 min-h-[110px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-4 text-center cursor-pointer relative overflow-hidden ${
              dragActive 
                ? 'border-[#7B2FF7] bg-[#7B2FF7]/10 scale-[0.99] shadow-[0_0_15px_#7B2FF7]' 
                : 'border-purple-950/40 bg-[#161616] hover:bg-[#1C1C1C] hover:border-purple-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={selectFilesViaDialog}
              className="hidden"
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-[#C77DFF] animate-spin" />
                <p className="text-xs font-semibold text-[#C77DFF] animate-pulse">Encrypting & Storing Images...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="p-2 rounded-full bg-[#20103A] text-[#C77DFF] border border-purple-900/20">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-gray-200">
                  Drag & drop private photos or <span className="text-[#C77DFF] underline">browse</span>
                </p>
                <p className="text-[10px] text-gray-500">Supports multiple files • Safe auto-downscaling</p>
              </div>
            )}
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredImages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-gray-600">
            <ImageIcon className="w-12 h-12 text-purple-950 mb-2" />
            <p className="text-sm">No photos found in this vault section.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredImages.map((img) => (
              <motion.div
                key={img.id}
                onClick={() => {
                  setSelectedImage(img);
                  setCustomTitle(img.title);
                  setSelectedCategory(img.category);
                }}
                layoutId={`img-card-${img.id}`}
                className="group relative aspect-square rounded-2xl bg-gradient-to-tr from-[#151515] to-[#20152D] overflow-hidden border border-purple-950/20 hover:border-purple-800/40 shadow-sm cursor-pointer"
              >
                {/* Thumb Image */}
                <img 
                  src={img.base64} 
                  alt={img.title} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Glassy overlay controls */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] bg-black/50 text-[#C77DFF] px-2 py-0.5 rounded-full border border-purple-900/35 font-mono">
                      {img.category}
                    </span>
                    <button
                      onClick={(e) => toggleFavorite(img, e)}
                      className="p-1 rounded-full bg-black/60 text-gray-300 hover:text-yellow-400"
                    >
                      <Star className={`w-3.5 h-3.5 ${img.favorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                    </button>
                  </div>
                  <div className="flex justify-between items-end gap-1">
                    <p className="text-[11px] font-bold text-white truncate flex-1">{img.title}</p>
                    <Eye className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </div>
                </div>

                {/* Quick Favorite Icon indicator on normal screen */}
                {img.favorite && (
                  <div className="absolute top-2 right-2 p-1 rounded-full bg-black/50 border border-purple-900/20 group-hover:hidden">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modern Lightbox Visualizer Overlay */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0A0A0A]/95 flex flex-col justify-between p-4"
          >
            {/* Lightbox header */}
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setSelectedImage(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Gallery</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerDownload(selectedImage)}
                  className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-[#2A2A2A] text-gray-300 hover:text-white border border-purple-950/20 transition-all cursor-pointer"
                  title="Export / Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteImage(selectedImage.id!)}
                  className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-red-950/30 border border-purple-950/20 text-red-400 hover:border-red-800 transition-all cursor-pointer"
                  title="Delete permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Immersive centered image canvas */}
            <div className="flex-1 flex items-center justify-center p-2 max-h-[60vh] sm:max-h-[70vh]">
              <img 
                src={selectedImage.base64} 
                alt={selectedImage.title}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-purple-950/30"
              />
            </div>

            {/* Custom interactive details drawer */}
            <div className="w-full max-w-xl mx-auto bg-[#161616] border border-purple-950/20 rounded-3xl p-5 flex flex-col gap-4 shadow-[0_0_30px_rgba(123,47,247,0.15)]">
              <div className="flex items-center justify-between gap-2 border-b border-purple-950/20 pb-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">File Name</span>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="bg-transparent text-sm font-bold text-gray-100 outline-none focus:text-[#C77DFF]"
                  />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Stored Section</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-[#0A0A0A] border border-purple-900/30 text-gray-300 text-xs rounded-xl px-2.5 py-1 outline-none"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#20103A] text-[#C77DFF]">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-[9px] font-mono uppercase">Compressed Size</p>
                    <p className="text-gray-200 font-semibold">{formatSize(selectedImage.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#20103A] text-[#C77DFF]">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-[9px] font-mono uppercase">Imported On</p>
                    <p className="text-gray-200 font-semibold">
                      {new Date(selectedImage.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveDetails}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] hover:from-[#9D4EDD] text-xs font-bold text-white shadow-lg cursor-pointer"
                >
                  Save Metadata
                </button>
                <button
                  onClick={(e) => toggleFavorite(selectedImage, e)}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    selectedImage.favorite
                      ? 'bg-yellow-950/20 border-yellow-700 text-yellow-400'
                      : 'bg-[#1A1A1A] border-purple-950/20 text-gray-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${selectedImage.favorite ? 'fill-yellow-400' : ''}`} />
                  <span className="text-xs font-bold">{selectedImage.favorite ? 'Favorited' : 'Favorite'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
