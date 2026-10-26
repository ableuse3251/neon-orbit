import React, { useState, useRef, useEffect } from 'react';
import { Check, Lock, Sparkles, Shield, Package, Sparkle } from 'lucide-react';
import { motion } from 'motion/react';
import { animate } from 'animejs';
import { PlayerProfile, CosmeticCategory, Rarity, CosmeticItem } from '../types/game';
import { COSMETIC_ITEMS, COSMETIC_COLLECTIONS, CosmeticCollection } from '../shared/cosmetics';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { api } from '../utils/api';
import { audioManager } from '../utils/audio';
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
} from './ui/Icons';
import { KokonutModal, KokonutTabs, KokonutCard, KokonutButton, KokonutBadge } from './ui/kokonut';

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
  const [longPressItem, setLongPressItem] = useState<string | null>(null);
  const longPressTimerRef = useRef<any>(null);

  const handleTouchStart = (itemId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressItem(itemId);
      triggerHaptic('medium');
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

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
    { id: 'ship', labelEn: 'SHIPS', labelRu: 'КОРАБЛИ', icon: <ShipCategoryIcon size={16} /> },
    { id: 'trail', labelEn: 'TRAILS', labelRu: 'СЛЕДЫ', icon: <TrailCategoryIcon size={16} /> },
    { id: 'backdrop', labelEn: 'BACKDROPS', labelRu: 'ФОНЫ', icon: <BackdropCategoryIcon size={16} /> },
    { id: 'explosion', labelEn: 'EXPLOSIONS', labelRu: 'ВЗРЫВЫ', icon: <ExplosionCategoryIcon size={16} /> },
    { id: 'frame', labelEn: 'FRAMES', labelRu: 'РАМКИ', icon: <FrameCategoryIcon size={16} /> },
    { id: 'theme', labelEn: 'THEMES', labelRu: 'ТЕМЫ', icon: <ThemeCategoryIcon size={16} /> },
    { id: 'title', labelEn: 'TITLES', labelRu: 'ТИТУЛЫ', icon: <TitleCategoryIcon size={16} /> },
  ];

  const getRarityVariant = (rarity: Rarity): 'gold' | 'pink' | 'cyan' | 'purple' | 'glass' => {
    switch (rarity) {
      case 'legendary':
        return 'gold';
      case 'epic':
        return 'pink';
      case 'rare':
        return 'cyan';
      case 'common':
      default:
        return 'glass';
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
      audioManager.playNavReject();
      triggerHaptic('error');
      return;
    }
    setLoadingItemId(item.id);
    try {
      const res = await api.buyItem(item.id);
      audioManager.playNavConfirm();
      triggerHaptic('success');
      const updated: PlayerProfile = {
        ...profile,
        stardust: res.remainingStardust ?? profile.stardust - item.priceStardust,
        unlockedCosmetics: Array.from(new Set([...profile.unlockedCosmetics, item.id])),
      };
      onUpdateProfile(updated);
    } catch (err) {
      audioManager.playNavReject();
      triggerHaptic('error');
      console.warn('Shop purchase error:', err);
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleEquip = async (item: CosmeticItem) => {
    setLoadingItemId(item.id);
    try {
      await api.equipItem(item.category, item.id);
      audioManager.playNavConfirm();
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
      audioManager.playNavReject();
      triggerHaptic('error');
      console.warn('Equip error:', err);
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleBuyCollection = async (coll: CosmeticCollection) => {
    const missingIds = coll.itemIds.filter((id) => !profile.unlockedCosmetics.includes(id));
    if (missingIds.length === 0) {
      audioManager.playNavAction(1.0);
      triggerHaptic('selection');
      return;
    }
    const missingItems = COSMETIC_ITEMS.filter((i) => missingIds.includes(i.id));
    const totalPrice = missingItems.reduce((acc, i) => acc + i.priceStardust, 0);
    const discountedPrice = Math.round(totalPrice * (1 - coll.discountPercent / 100));

    if (profile.stardust < discountedPrice) {
      audioManager.playNavReject();
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
      audioManager.playNavConfirm();
      triggerHaptic('success');
      const newUnlocked = Array.from(new Set([...profile.unlockedCosmetics, ...missingIds]));
      const updated: PlayerProfile = {
        ...profile,
        stardust: Math.max(0, profile.stardust - discountedPrice),
        unlockedCosmetics: newUnlocked,
      };
      onUpdateProfile(updated);
    } catch (err) {
      audioManager.playNavReject();
      triggerHaptic('error');
      console.warn('Collection purchase error:', err);
    } finally {
      setLoadingItemId(null);
    }
  };

  const itemsInCategory = COSMETIC_ITEMS.filter((i) => i.category === activeCategory);

  return (
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={`${t.hangarTitle} (Dust Shop & Pilot Market)`}
      icon={<Sparkles className="w-5 h-5 text-[#00f5d4] animate-pulse" />}
      badge={
        <KokonutBadge variant="gold" size="sm" icon={<StardustCrystalIcon size={12} />}>
          <span ref={stardustCountRef}>{profile.stardust}</span>
        </KokonutBadge>
      }
      maxWidth="xl"
    >
      <div className="flex flex-col gap-3">
        {/* Tab Switcher: Individual Catalog vs Collections */}
        <KokonutTabs
          tabs={[
            { id: 'shop', label: 'Individual Catalog (65+)', icon: <Sparkle className="w-3.5 h-3.5" /> },
            { id: 'collections', label: 'Collections & Bundles (-20%)', icon: <Package className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'shop' | 'collections')}
          layoutId="cosmeticCatalogTabs"
        />

        {activeTab === 'shop' ? (
          <>
            {/* 7 Category Tabs */}
            <div className="grid grid-cols-7 gap-1 bg-[#0b061d]/90 p-1 rounded-2xl border border-[#00f5d4]/20 overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    audioManager.playNavTab(cat.id);
                    triggerHaptic('selection');
                    setActiveCategory(cat.id);
                    const first = COSMETIC_ITEMS.find((i) => i.category === cat.id);
                    if (first) setSelectedPreviewItem(first);
                  }}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 text-[8px] sm:text-[9px] font-pixel transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-r from-[#00f5d4] to-[#33f7dd] text-[#080417] font-bold shadow-[0_0_12px_rgba(0,245,212,0.4)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.icon}
                  <span className="truncate max-w-full">
                    {profile.lang === 'ru' ? cat.labelRu : cat.labelEn}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Item Spotlight Card */}
            {selectedPreviewItem && (
              <KokonutCard variant="glow" hoverEffect={false} className="flex flex-col sm:flex-row items-center gap-4 p-4">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#0a0518] border-2 border-[#00f5d4]/60 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_20px_rgba(0,245,212,0.25)]">
                  {selectedPreviewItem.category === 'ship' ? (
                    <MotionShipPreview
                      shipId={selectedPreviewItem.id}
                      color={selectedPreviewItem.previewColor || '#00f5d4'}
                      size={70}
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-inner"
                      style={{ backgroundColor: `${selectedPreviewItem.previewColor || '#00f5d4'}30`, color: selectedPreviewItem.previewColor || '#00f5d4' }}
                    >
                      ✦
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between flex-1 w-full gap-2 text-center sm:text-left">
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h4 className="font-pixel text-xs sm:text-sm text-white font-bold">
                        {profile.lang === 'ru' ? selectedPreviewItem.nameRu : selectedPreviewItem.nameEn}
                      </h4>
                      <KokonutBadge variant={getRarityVariant(selectedPreviewItem.rarity)} size="sm">
                        {selectedPreviewItem.rarity}
                      </KokonutBadge>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 font-sans">
                      {profile.lang === 'ru' ? selectedPreviewItem.descRu : selectedPreviewItem.descEn}
                    </p>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    {isEquipped(selectedPreviewItem) ? (
                      <KokonutButton variant="glow" size="sm" disabled icon={<Check className="w-4 h-4" />}>
                        {profile.lang === 'ru' ? 'ЭКИПИРОВАНО' : 'EQUIPPED'}
                      </KokonutButton>
                    ) : isUnlocked(selectedPreviewItem) ? (
                      <KokonutButton
                        variant="glow"
                        size="sm"
                        isLoading={loadingItemId === selectedPreviewItem.id}
                        onClick={() => handleEquip(selectedPreviewItem)}
                      >
                        {profile.lang === 'ru' ? 'ЭКИПИРОВАТЬ' : 'EQUIP'}
                      </KokonutButton>
                    ) : (
                      <KokonutButton
                        variant="shimmer"
                        size="sm"
                        isLoading={loadingItemId === selectedPreviewItem.id}
                        onClick={() => handleBuy(selectedPreviewItem)}
                        icon={<StardustCrystalIcon size={14} color="#ffb703" />}
                      >
                        {selectedPreviewItem.priceStardust.toLocaleString()} STARDUST
                      </KokonutButton>
                    )}
                  </div>
                </div>
              </KokonutCard>
            )}

            {/* Catalog Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {itemsInCategory.map((item) => {
                const unlocked = isUnlocked(item);
                const equipped = isEquipped(item);
                const selected = selectedPreviewItem?.id === item.id;

                return (
                  <KokonutCard
                    key={item.id}
                    variant={selected ? 'glow' : 'glass'}
                    onClick={() => {
                      if (longPressItem === item.id) {
                        setLongPressItem(null);
                      } else {
                        audioManager.playNavHover();
                        setSelectedPreviewItem(item);
                      }
                    }}
                    onTouchStart={() => !unlocked && handleTouchStart(item.id)}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={() => !unlocked && handleTouchStart(item.id)}
                    onMouseUp={handleTouchEnd}
                    className={`p-3 cursor-pointer flex flex-col items-center gap-2 border text-center transition-all relative group ${
                      selected ? 'border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.3)]' : 'border-white/10'
                    }`}
                  >
                    <div className="relative w-12 h-12 rounded-xl bg-[#0a0518] flex items-center justify-center overflow-hidden">
                      {item.category === 'ship' ? (
                        <MotionShipPreview shipId={item.id} color={item.previewColor || '#00f5d4'} size={36} />
                      ) : (
                        <span className="text-base" style={{ color: item.previewColor || '#00f5d4' }}>
                          ✦
                        </span>
                      )}
                      {!unlocked && (
                        <>
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-gray-400" />
                          </div>
                          {/* Subtle Tooltip on Hover / Long-Press revealing unlock requirement */}
                          <div className={`absolute -top-11 left-1/2 -translate-x-1/2 bg-[#120a2e]/95 border border-[#ffb703]/60 px-2.5 py-1 rounded-xl shadow-[0_0_15px_rgba(255,183,3,0.3)] text-[9px] font-mono text-[#ffb703] whitespace-nowrap z-40 pointer-events-none transition-all duration-200 ${
                            longPressItem === item.id ? 'opacity-100 scale-105' : 'opacity-0 group-hover:opacity-100'
                          }`}>
                            {profile.lang === 'ru' ? `🔒 Требуется: ${item.priceStardust.toLocaleString()} Стардаста` : `🔒 Unlock: ${item.priceStardust.toLocaleString()} Stardust`}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-col items-center min-w-0 w-full">
                      <span className="font-pixel text-[10px] text-white truncate w-full">
                        {profile.lang === 'ru' ? item.nameRu : item.nameEn}
                      </span>
                      {equipped ? (
                        <KokonutBadge variant="cyan" size="sm" className="mt-1">
                          EQUIPPED
                        </KokonutBadge>
                      ) : unlocked ? (
                        <KokonutBadge variant="glass" size="sm" className="mt-1">
                          UNLOCKED
                        </KokonutBadge>
                      ) : (
                        <span className="text-[10px] text-[#ffb703] font-pixel flex items-center gap-0.5 mt-1 font-bold">
                          <StardustCrystalIcon size={10} color="#ffb703" />
                          {item.priceStardust.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </KokonutCard>
                );
              })}
            </div>
          </>
        ) : (
          /* Collections & Bundles View */
          <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
            {COSMETIC_COLLECTIONS.map((coll) => {
              const missingIds = coll.itemIds.filter((id) => !profile.unlockedCosmetics.includes(id));
              const isOwned = missingIds.length === 0;
              const items = COSMETIC_ITEMS.filter((i) => coll.itemIds.includes(i.id));
              const totalPrice = items.reduce((acc, i) => acc + i.priceStardust, 0);
              const discountedPrice = Math.round(totalPrice * (1 - coll.discountPercent / 100));

              return (
                <KokonutCard key={coll.id} variant="glow" hoverEffect={false} className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-pixel text-xs sm:text-sm text-[#00f5d4] font-bold">
                        {profile.lang === 'ru' ? coll.nameRu : coll.nameEn}
                      </h4>
                      <p className="text-[11px] text-gray-400 font-sans">
                        {coll.discountPercent}% OFF • {coll.itemIds.length} ITEMS
                      </p>
                    </div>
                    <KokonutBadge variant="pink" size="md">
                      -{coll.discountPercent}% OFF
                    </KokonutBadge>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {items.map((it) => (
                      <div key={it.id} className="p-2 rounded-xl bg-[#090417] border border-white/10 flex flex-col items-center gap-1 text-center">
                        <span className="font-pixel text-[9px] text-white truncate w-full">
                          {profile.lang === 'ru' ? it.nameRu : it.nameEn}
                        </span>
                        <KokonutBadge variant={getRarityVariant(it.rarity)} size="sm">
                          {it.rarity}
                        </KokonutBadge>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="line-through text-gray-500 text-xs font-mono">
                        {totalPrice.toLocaleString()} STARDUST
                      </span>
                      <span className="text-[#ffb703] font-pixel text-xs sm:text-sm font-bold flex items-center gap-1">
                        <StardustCrystalIcon size={14} color="#ffb703" />
                        {discountedPrice.toLocaleString()}
                      </span>
                    </div>

                    {isOwned ? (
                      <KokonutButton variant="glow" size="sm" disabled icon={<Check className="w-4 h-4" />}>
                        {profile.lang === 'ru' ? 'КУПЛЕНО' : 'BUNDLE OWNED'}
                      </KokonutButton>
                    ) : (
                      <KokonutButton
                        variant="shimmer"
                        size="sm"
                        isLoading={loadingItemId === coll.id}
                        onClick={() => handleBuyCollection(coll)}
                      >
                        {profile.lang === 'ru' ? 'КУПИТЬ СЕТ' : 'BUY SET'}
                      </KokonutButton>
                    )}
                  </div>
                </KokonutCard>
              );
            })}
          </div>
        )}
      </div>
    </KokonutModal>
  );
};
