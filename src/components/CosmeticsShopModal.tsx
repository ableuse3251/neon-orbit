import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Lock, Sparkles, Shield, Package, Sparkle } from 'lucide-react';
import { motion } from 'motion/react';
import { animate } from 'animejs';
import { PlayerProfile, CosmeticCategory, Rarity, CosmeticItem } from '../types/game';
import { COSMETIC_ITEMS, COSMETIC_COLLECTIONS, CosmeticCollection } from '../shared/cosmetics';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { api } from '../utils/api';
import {
  ShipCategoryIcon,
  TrailCategoryIcon,
  BackdropCategoryIcon,
  ExplosionCategoryIcon,
  FrameCategoryIcon,
  ThemeCategoryIcon,
  TitleCategoryIcon,
  MotionShipPreview,
  StardustCrystalIcon,
  TactileButton,
} from './ui/Icons';

interface CosmeticsShopModalProps {
  profile: PlayerProfile;
  onUpdateProfile: (updatedProfile: PlayerProfile) => void;
  onClose: () => void;
}

export const CosmeticsShopModal: React.FC<CosmeticsShopModalProps> = ({
  profile,
  onUpdateProfile,
  onClose,
}) => {
  const t = getTranslation(profile.lang);
  const [activeTab, setActiveTab] = useState<'shop' | 'collections'>('shop');
  const [activeCategory, setActiveCategory] = useState<CosmeticCategory>('ship');
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<CosmeticItem>(() => {
    return COSMETIC_ITEMS.find((c) => c.category === 'ship') || COSMETIC_ITEMS[0];
  });
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const stardustCountRef = useRef<HTMLSpanElement>(null);
  const prevStardustRef = useRef<number>(profile.stardust);

  useEffect(() => {
    if (typeof window === 'undefined' || !stardustCountRef.current) return;
    const startVal = prevStardustRef.current;
    const endVal = profile.stardust;
    prevStardustRef.current = endVal;
    if (startVal === endVal) {
      stardustCountRef.current.textContent = String(endVal);
      return;
    }
    const valObj = { val: startVal };
    animate(valObj, {
      val: endVal,
      duration: 600,
      ease: 'outExpo',
      onUpdate: () => {
        if (stardustCountRef.current) {
          stardustCountRef.current.textContent = Math.round(valObj.val).toLocaleString();
        }
      },
    });
  }, [profile.stardust]);

  const categories: Array<{
    id: CosmeticCategory;
    labelEn: string;
    labelRu: string;
    icon: React.ReactNode;
  }> = [
    { id: 'ship', labelEn: 'SHIPS', labelRu: 'КОРАБЛИ', icon: <ShipCategoryIcon size={18} /> },
    { id: 'trail', labelEn: 'TRAILS', labelRu: 'СЛЕДЫ', icon: <TrailCategoryIcon size={18} /> },
    { id: 'backdrop', labelEn: 'BACKDROPS', labelRu: 'ФОНЫ', icon: <BackdropCategoryIcon size={18} /> },
    { id: 'explosion', labelEn: 'EXPLOSIONS', labelRu: 'ВЗРЫВЫ', icon: <ExplosionCategoryIcon size={18} /> },
    { id: 'frame', labelEn: 'FRAMES', labelRu: 'РАМКИ', icon: <FrameCategoryIcon size={18} /> },
    { id: 'theme', labelEn: 'THEMES', labelRu: 'ТЕМЫ', icon: <ThemeCategoryIcon size={18} /> },
    { id: 'title', labelEn: 'TITLES', labelRu: 'ТИТУЛЫ', icon: <TitleCategoryIcon size={18} /> },
  ];

  const getRarityBadge = (rarity: Rarity) => {
    switch (rarity) {
      case 'legendary':
        return { label: 'LEGENDARY', color: 'text-[#ffb703]', bg: 'bg-[#ffb703]/15 border-[#ffb703] shadow-[0_0_10px_#ffb703]' };
      case 'epic':
        return { label: 'EPIC', color: 'text-[#ff007f]', bg: 'bg-[#ff007f]/15 border-[#ff007f] shadow-[0_0_10px_#ff007f]' };
      case 'rare':
        return { label: 'RARE', color: 'text-[#00f5d4]', bg: 'bg-[#00f5d4]/15 border-[#00f5d4] shadow-[0_0_8px_#00f5d4]' };
      case 'common':
      default:
        return { label: 'COMMON', color: 'text-gray-300', bg: 'bg-gray-800/40 border-gray-500' };
    }
  };

  const isEquipped = (item: CosmeticItem): boolean => {
    switch (item.category) {
      case 'ship':
        return profile.selectedShip === item.id;
      case 'trail':
        return profile.selectedTrail === item.id;
      case 'backdrop':
        return profile.selectedBackdrop === item.id;
      case 'explosion':
        return profile.selectedExplosion === item.id;
      case 'frame':
        return profile.selectedFrame === item.id;
      case 'theme':
        return profile.selectedTheme === item.id;
      case 'title':
        return (profile as any).selectedTitle === item.id;
      default:
        return false;
    }
  };

  const isUnlocked = (item: CosmeticItem): boolean => {
    if (item.priceStardust === 0) return true;
    return profile.unlockedCosmetics.includes(item.id);
  };

  const handleBuy = async (item: CosmeticItem) => {
    if (profile.stardust < item.priceStardust) {
      triggerHaptic('error');
      return;
    }
    setLoadingItemId(item.id);
    try {
      const res = await api.buyItem(item.id);
      triggerHaptic('success');
      const updated: PlayerProfile = {
        ...profile,
        stardust: res.remainingStardust ?? profile.stardust - item.priceStardust,
        unlockedCosmetics: Array.from(new Set([...profile.unlockedCosmetics, item.id])),
      };
      onUpdateProfile(updated);
    } catch (err) {      triggerHaptic('error');
      console.warn('Shop purchase error:', err);
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleEquip = async (item: CosmeticItem) => {
    setLoadingItemId(item.id);
    try {
      await api.equipItem(item.category, item.id);
      triggerHaptic('selection');
      const updated: PlayerProfile = { ...profile };
      switch (item.category) {
        case 'ship':
          updated.selectedShip = item.id;
          break;
        case 'trail':
          updated.selectedTrail = item.id;
          break;
        case 'backdrop':
          updated.selectedBackdrop = item.id;
          break;
        case 'explosion':
          updated.selectedExplosion = item.id;
          break;
        case 'frame':
          updated.selectedFrame = item.id;
          break;
        case 'theme':
          updated.selectedTheme = item.id;
          break;
        case 'title':
          (updated as any).selectedTitle = item.id;
          break;
      }
      onUpdateProfile(updated);
    } catch (err) {
      triggerHaptic('error');
      console.warn('Equip error:', err);
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleBuyCollection = async (coll: CosmeticCollection) => {
    const missingIds = coll.itemIds.filter((id) => !profile.unlockedCosmetics.includes(id));
    if (missingIds.length === 0) {
      triggerHaptic('selection');
      return;
    }
    const missingItems = COSMETIC_ITEMS.filter((i) => missingIds.includes(i.id));
    const totalPrice = missingItems.reduce((acc, i) => acc + i.priceStardust, 0);
    const discountedPrice = Math.round(totalPrice * (1 - coll.discountPercent / 100));

    if (profile.stardust < discountedPrice) {
      triggerHaptic('error');
      return;
    }
    setLoadingItemId(coll.id);
    try {
      for (const item of missingItems) {
        if (item.priceStardust > 0 && !profile.unlockedCosmetics.includes(item.id)) {
          await api.buyItem(item.id);
        }
      }
      triggerHaptic('success');
      const newUnlocked = Array.from(new Set([...profile.unlockedCosmetics, ...missingIds]));
      const updated: PlayerProfile = {
        ...profile,
        stardust: Math.max(0, profile.stardust - discountedPrice),
        unlockedCosmetics: newUnlocked,
      };
      onUpdateProfile(updated);
    } catch (err) {
      triggerHaptic('error');
      console.warn('Collection purchase error:', err);
    } finally {
      setLoadingItemId(null);
    }
  };

  const itemsInCategory = COSMETIC_ITEMS.filter((i) => i.category === activeCategory);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md font-mono-tech select-none"
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="relative w-full max-w-lg bg-[#120a2e]/95 border-2 border-[#9d4edd] rounded-2xl p-3.5 sm:p-5 shadow-[0_0_35px_rgba(157,78,221,0.35)] flex flex-col gap-2.5 sm:gap-3 text-white max-h-[94vh] sm:max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2 sm:pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f5d4] animate-pulse" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {t.hangarTitle} (Dust Shop & Pilot Market)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1.5 bg-[#210b42] px-3 py-1 rounded-full border border-[#ffb703]/50 text-[#ffb703] shadow-[0_0_10px_rgba(255,183,3,0.3)]"
            >
              <StardustCrystalIcon size={14} />
              <span ref={stardustCountRef} className="font-pixel text-xs font-bold">
                {profile.stardust}
              </span>
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Tab Switcher: Individual Items vs Collections / Sets */}
        <div className="flex gap-2 bg-[#0b071e] p-1 rounded-xl border border-[#9d4edd]/30 shrink-0">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('shop');
            }}
            className={`relative flex-1 py-1.5 rounded-lg font-pixel text-[10px] transition-colors flex items-center justify-center gap-1.5 z-10 ${
              activeTab === 'shop'
                ? 'text-white font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {activeTab === 'shop' && (
              <motion.div
                layoutId="activeShopTabIndicator"
                className="absolute inset-0 bg-[#9d4edd] rounded-lg shadow-[0_0_12px_#9d4edd] -z-10"
                transition={{ type: 'spring', damping: 25, stiffness: 380 }}
              />
            )}
            <Sparkle className="w-3.5 h-3.5" /> Individual Catalog (65+)
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('collections');
            }}
            className={`relative flex-1 py-1.5 rounded-lg font-pixel text-[10px] transition-colors flex items-center justify-center gap-1.5 z-10 ${
              activeTab === 'collections'
                ? 'text-white font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {activeTab === 'collections' && (
              <motion.div
                layoutId="activeShopTabIndicator"
                className="absolute inset-0 bg-[#ff007f] rounded-lg shadow-[0_0_12px_#ff007f] -z-10"
                transition={{ type: 'spring', damping: 25, stiffness: 380 }}
              />
            )}
            <Package className="w-3.5 h-3.5" /> Collections & Bundles (-20%)
          </motion.button>
        </div>

        {activeTab === 'shop' ? (
          <>
            {/* 7 Category Tabs with Custom Modern Vector Icons */}
            <div className="grid grid-cols-7 gap-1 bg-[#0b071e] p-1 rounded-xl border border-[#9d4edd]/30 shrink-0 overflow-x-auto">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    triggerHaptic('selection');
                    setActiveCategory(cat.id);
                    const first = COSMETIC_ITEMS.find((i) => i.category === cat.id);
                    if (first) setSelectedPreviewItem(first);
                  }}
                  className={`relative py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[8px] font-pixel transition-colors z-10 ${
                    activeCategory === cat.id
                      ? 'text-[#0b071e] font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {activeCategory === cat.id && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute inset-0 bg-[#00f5d4] rounded-lg shadow-[0_0_12px_#00f5d4] -z-10"
                      transition={{ type: 'spring', damping: 25, stiffness: 380 }}
                    />
                  )}
                  {cat.icon}
                  <span className="hidden sm:inline">
                    {profile.lang === 'ru' ? cat.labelRu : cat.labelEn}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Fitting Room Interactive Live Preview Window */}
            <div className="relative w-full h-28 sm:h-32 rounded-xl bg-[#0b071e] border-2 border-[#9d4edd]/50 flex items-center justify-between overflow-hidden p-3 shadow-inner shrink-0">
              <div
                className="absolute inset-0 opacity-20 animate-pulse"
                style={{
                  background: `radial-gradient(circle, ${selectedPreviewItem.previewColor} 0%, transparent 75%)`,
                }}
              />

              <div className="relative flex items-center gap-3 z-10 w-full">
                {/* 3D Motion Ship Previewer */}
                <div className="shrink-0">
                  <MotionShipPreview
                    shipId={selectedPreviewItem.id}
                    color={selectedPreviewItem.previewColor}
                    accentColor={selectedPreviewItem.accentColor}
                    size={90}
                  />
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-xs sm:text-sm text-white truncate">
                      {profile.lang === 'ru' ? selectedPreviewItem.nameRu : selectedPreviewItem.nameEn}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-300 font-mono-tech mt-0.5 line-clamp-2">
                    {profile.lang === 'ru' ? selectedPreviewItem.descRu : selectedPreviewItem.descEn}
                  </span>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`text-[8px] font-pixel px-2 py-0.5 rounded border uppercase ${
                        getRarityBadge(selectedPreviewItem.rarity).bg
                      } ${getRarityBadge(selectedPreviewItem.rarity).color}`}
                    >
                      {selectedPreviewItem.rarity}
                    </span>
                    <span className="text-[8px] text-[#00f5d4] font-pixel animate-pulse">
                      ⚡ Click ship for plasma test fire
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Item Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 pr-1 max-h-[34vh]">
              {itemsInCategory.map((item) => {
                const unlocked = isUnlocked(item);
                const equipped = isEquipped(item);
                const rarityInfo = getRarityBadge(item.rarity);
                const name = profile.lang === 'ru' ? item.nameRu : item.nameEn;

                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedPreviewItem(item);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                      selectedPreviewItem.id === item.id
                        ? 'border-[#00f5d4] bg-[#00f5d4]/10 shadow-[0_0_12px_rgba(0,245,212,0.3)]'
                        : 'border-[#9d4edd]/25 bg-[#0b071e] hover:border-[#9d4edd]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border"
                          style={{
                            backgroundColor: `${item.previewColor}20`,
                            borderColor: item.previewColor,
                          }}
                        >
                          {item.iconSymbol}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-pixel text-[10px] text-white truncate max-w-[110px]">
                            {name}
                          </span>
                          <span className={`text-[7px] font-pixel ${rarityInfo.color}`}>
                            {item.rarity.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#9d4edd]/15">
                      {equipped ? (
                        <span className="w-full py-1 bg-[#00f5d4] text-[#0b071e] font-pixel text-[9px] font-bold rounded flex items-center justify-center gap-1 shadow-[0_0_8px_#00f5d4]">
                          <Check className="w-3 h-3" /> {t.equippedBadge}
                        </span>
                      ) : unlocked ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEquip(item);
                          }}
                          className="w-full py-1 bg-[#210b42] border border-[#9d4edd] hover:border-[#00f5d4] text-white font-pixel text-[9px] rounded transition-colors"
                        >
                          {t.equipBtn}
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuy(item);
                          }}
                          className={`w-full py-1 text-white font-pixel text-[9px] font-bold rounded flex items-center justify-center gap-1 ${
                            profile.stardust >= item.priceStardust
                              ? 'bg-[#ff007f] hover:bg-[#ff007f]/90 shadow-[0_0_8px_#ff007f]'
                              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>{item.priceStardust} Dust</span>
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        ) : (
          /* Collections & Bundles View */
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[46vh]">
            <p className="text-[10px] text-gray-300 font-mono-tech px-1">
              Complete set bundles with a <span className="text-[#00f5d4] font-bold">15%–20% discount</span>. All unlocked items automatically sync!
            </p>
            {COSMETIC_COLLECTIONS.map((coll) => {
              const missingIds = coll.itemIds.filter((id) => !profile.unlockedCosmetics.includes(id));
              const missingItems = COSMETIC_ITEMS.filter((i) => missingIds.includes(i.id));
              const originalPrice = missingItems.reduce((acc, i) => acc + i.priceStardust, 0);
              const discountedPrice = Math.round(originalPrice * (1 - coll.discountPercent / 100));
              const isFullyUnlocked = missingIds.length === 0;

              return (
                <motion.div
                  key={coll.id}
                  whileHover={{ scale: 1.01 }}
                  className="p-3.5 rounded-xl border border-[#9d4edd]/40 bg-[#0b071e] flex flex-col gap-2.5 shadow-md"
                  style={{ borderColor: coll.previewColor }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-[#ffb703]" />
                      <div>
                        <h3 className="font-pixel text-xs text-white">
                          {profile.lang === 'ru' ? coll.nameRu : coll.nameEn}
                        </h3>
                        <span className="text-[9px] text-[#ffb703] font-pixel">
                          Bundle Discount: -{coll.discountPercent}%
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-pixel px-2 py-1 bg-[#210b42] rounded-lg border border-[#9d4edd]/40">
                      {coll.itemIds.length} Items Set
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#9d4edd]/20">
                    {isFullyUnlocked ? (
                      <span className="w-full py-1.5 bg-[#00f5d4]/20 border border-[#00f5d4] text-[#00f5d4] font-pixel text-[10px] font-bold rounded flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Collection Fully Owned
                      </span>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleBuyCollection(coll)}
                        disabled={profile.stardust < discountedPrice}
                        className={`w-full py-1.5 font-pixel text-[10px] font-bold rounded flex items-center justify-center gap-1 ${
                          profile.stardust >= discountedPrice
                            ? 'bg-[#ff007f] hover:bg-[#ff007f]/90 text-white shadow-[0_0_10px_#ff007f]'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Buy Missing ({discountedPrice} Stardust)</span>
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Fair Play Footer Banner */}
        <div className="p-2 rounded-lg bg-[#0b071e] border border-[#9d4edd]/20 flex items-center justify-center gap-2 text-[10px] text-gray-400 text-center font-mono-tech shrink-0">
          <Shield className="w-3.5 h-3.5 text-[#00f5d4]" />
          <span>Cosmetics only. Zero impact on score or rankings!</span>
        </div>
      </motion.div>
    </motion.div>
  );
};
