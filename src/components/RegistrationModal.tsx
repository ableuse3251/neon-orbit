import React, { useState, useEffect, useRef } from "react";
import { User, Camera, Check, AlertCircle, Sparkles, Upload, ShieldCheck } from "lucide-react";
import { PlayerProfile } from "../types/game";
import { api } from "../utils/api";
import { getTelegramApp, triggerHaptic } from "../utils/telegram";
import { PRESET_AVATARS, compressImageToDataUrl } from "../shared/avatars";
import { KokonutModal, KokonutInput, KokonutButton, KokonutCard, KokonutBadge } from "./ui/kokonut";

interface RegistrationModalProps {
  profile: PlayerProfile;
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (updatedUsername: string, avatarUrl?: string) => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  profile,
  isOpen,
  onClose,
  onRegistered,
}) => {
  const telegramApp = getTelegramApp();
  const tgUser = telegramApp?.initDataUnsafe?.user;

  // Telegram pre-fills
  const tgUsername = tgUser?.username || "";
  const tgPhotoUrl = tgUser?.photo_url || "";

  const [nickname, setNickname] = useState<string>(() => {
    if (profile.username && profile.username !== "Pilot" && profile.username !== "synthwave_star") {
      return profile.username;
    }
    return tgUsername || profile.firstName || "";
  });

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(profile.avatarUrl || tgPhotoUrl || undefined);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("avatar_cyber_wing");
  
  const [checking, setChecking] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Validate nickname regex format: RU / EN letters, digits, spaces, hyphens, underscores
  const validateFormat = (val: string): boolean => {
    const trimmed = val.trim();
    if (trimmed.length < 2 || trimmed.length > 20) return false;
    return /^[a-zA-Z0-9а-яА-ЯёЁ_ -]+$/.test(trimmed);
  };

  const handleNicknameChange = (val: string) => {
    setNickname(val);
    setSubmitError("");
    setIsAvailable(null);

    if (checkDebounceTimer.current) {
      clearTimeout(checkDebounceTimer.current);
    }

    const trimmed = val.trim();
    if (!validateFormat(trimmed)) {
      if (trimmed.length < 2) {
        setStatusMessage(profile.lang === "ru" ? "Минимум 2 символа" : "Minimum 2 characters");
      } else if (trimmed.length > 20) {
        setStatusMessage(profile.lang === "ru" ? "Максимум 20 символов" : "Maximum 20 characters");
      } else {
        setStatusMessage(
          profile.lang === "ru"
            ? "Только буквы (RU/EN), цифры, пробел и подчёркивание"
            : "Only letters (RU/EN), numbers, space and underscore"
        );
      }
      setIsAvailable(false);
      return;
    }

    setChecking(true);
    setStatusMessage(profile.lang === "ru" ? "Проверка никнейма..." : "Checking availability...");

    checkDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await api.checkNickname(trimmed);
        if (res.available) {
          setIsAvailable(true);
          setStatusMessage(profile.lang === "ru" ? "Никнейм свободен" : "Nickname available");
        } else {
          setIsAvailable(false);
          setStatusMessage(res.reason || (profile.lang === "ru" ? "Этот никнейм уже занят" : "Nickname is already taken"));
        }
      } catch {
        // Fallback for offline / dev
        setIsAvailable(true);
        setStatusMessage(profile.lang === "ru" ? "Никнейм доступен" : "Nickname available");
      } finally {
        setChecking(false);
      }
    }, 400);
  };

  useEffect(() => {
    if (isOpen && nickname) {
      handleNicknameChange(nickname);
    }
  }, [isOpen]);

  const handleUseTelegramNickname = () => {
    if (tgUsername) {
      triggerHaptic("light");
      handleNicknameChange(tgUsername);
    }
  };

  const handleUseTelegramPhoto = () => {
    if (tgPhotoUrl) {
      triggerHaptic("light");
      setAvatarUrl(tgPhotoUrl);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      triggerHaptic("medium");
      const compressedDataUrl = await compressImageToDataUrl(file);
      setAvatarUrl(compressedDataUrl);
      setSubmitError("");
    } catch {
      setSubmitError(profile.lang === "ru" ? "Ошибка загрузки фото. Попробуйте другой файл." : "Image load error.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!validateFormat(trimmed) || isAvailable === false || checking) return;

    setSubmitting(true);
    setSubmitError("");
    triggerHaptic("medium");

    try {
      const finalAvatar = avatarUrl || undefined;
      const res = await api.registerUser({ nickname: trimmed, avatarUrl: finalAvatar });
      if (res.success) {
        triggerHaptic("success");
        onRegistered(trimmed, finalAvatar);
        onClose();
      } else {
        triggerHaptic("error");
        setSubmitError(res.error || (profile.lang === "ru" ? "Ошибка при регистрации" : "Registration failed"));
      }
    } catch (err: any) {
      triggerHaptic("error");
      setSubmitError(err.message || (profile.lang === "ru" ? "Ошибка соединения с сервером" : "Server connection error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KokonutModal
      isOpen={isOpen}
      onClose={onClose}
      title={profile.lang === "ru" ? "Регистрация Пилота" : "Pilot Registration"}
      icon={<Sparkles className="w-5 h-5" />}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Informational Kokonut Card */}
        <KokonutCard variant="glow" hoverEffect={false} className="p-3.5 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#00f5d4] shrink-0" />
          <p className="text-xs text-gray-200 leading-snug">
            {profile.lang === "ru"
              ? "Зарегистрируйтесь, чтобы сохранить свой прогресс и попасть в Зал Славы!"
              : "Register to save your cosmic progress and compete on global leaderboards!"}
          </p>
        </KokonutCard>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Avatar Section */}
          <KokonutCard variant="glass" hoverEffect={false} className="flex flex-col items-center gap-3">
            <span className="font-pixel text-[10px] sm:text-xs text-[#00f5d4] uppercase">
              {profile.lang === "ru" ? "1. Фото профиля (Аватар)" : "1. Profile Photo (Avatar)"}
            </span>

            {/* Avatar Preview */}
            <div className="relative w-20 h-20 rounded-2xl border-2 border-[#00f5d4] bg-[#14082b] flex items-center justify-center overflow-hidden shadow-[0_0_22px_rgba(0,245,212,0.4)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-[#00f5d4]" />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Upload & Preset Options */}
            <div className="flex flex-wrap items-center justify-center gap-2 w-full text-[10px]">
              {tgPhotoUrl && (
                <KokonutButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseTelegramPhoto}
                  icon={<Camera className="w-3 h-3" />}
                >
                  {profile.lang === "ru" ? "Telegram фото" : "Telegram Photo"}
                </KokonutButton>
              )}
              <KokonutButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                icon={<Upload className="w-3 h-3" />}
              >
                {profile.lang === "ru" ? "Загрузить фото" : "Upload Photo"}
              </KokonutButton>
            </div>

            {/* Preset Avatars Selector */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {PRESET_AVATARS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedPresetId(p.id);
                  }}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-sm transition-all cursor-pointer ${
                    selectedPresetId === p.id
                      ? "border-[#00f5d4] scale-110 shadow-[0_0_12px_#00f5d4]"
                      : "border-gray-700 hover:border-gray-500"
                  }`}
                  style={{ backgroundColor: `${p.color}20` }}
                  title={profile.lang === "ru" ? p.nameRu : p.nameEn}
                >
                  {p.badge}
                </button>
              ))}
            </div>
          </KokonutCard>

          {/* Nickname Section */}
          <KokonutCard variant="glass" hoverEffect={false} className="flex flex-col gap-2">
            <KokonutInput
              label={profile.lang === "ru" ? "2. Ваше Имя / Никнейм" : "2. Your Nickname"}
              maxLength={20}
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              placeholder={profile.lang === "ru" ? "Введите никнейм..." : "Enter nickname..."}
              error={isAvailable === false ? statusMessage : undefined}
              success={isAvailable === true}
              helperText={isAvailable === true ? statusMessage : checking ? (profile.lang === "ru" ? "Проверка..." : "Checking...") : undefined}
            />

            {/* Quick Telegram Username Button */}
            {tgUsername && nickname !== tgUsername && (
              <button
                type="button"
                onClick={handleUseTelegramNickname}
                className="text-[10px] text-[#00f5d4] hover:underline self-start flex items-center gap-1 font-pixel mt-0.5 cursor-pointer"
              >
                <span>⚡ {profile.lang === "ru" ? "Использовать ник Telegram:" : "Use Telegram handle:"}</span>
                <strong className="text-white">@{tgUsername}</strong>
              </button>
            )}
          </KokonutCard>

          {/* Submit Error */}
          {submitError && (
            <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500 text-red-300 text-xs text-center font-bold">
              {submitError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <KokonutButton
              type="submit"
              variant="glow"
              size="lg"
              isLoading={submitting || checking}
              disabled={isAvailable === false || !validateFormat(nickname)}
              className="w-full"
            >
              {profile.lang === "ru" ? "ЗАРЕГИСТРИРОВАТЬСЯ" : "REGISTER & SAVE"}
            </KokonutButton>

            <button
              type="button"
              onClick={onClose}
              className="py-2 text-[10px] text-gray-400 hover:text-white font-pixel text-center transition-colors cursor-pointer"
            >
              {profile.lang === "ru" ? "Пропустить пока" : "Skip for now"}
            </button>
          </div>
        </form>
      </div>
    </KokonutModal>
  );
};
