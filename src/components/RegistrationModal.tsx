import React, { useState, useEffect, useRef } from "react";
import { X, User, Camera, Check, AlertCircle, Loader2, Sparkles, Upload, ShieldCheck } from "lucide-react";
import { PlayerProfile } from "../types/game";
import { api } from "../utils/api";
import { getTelegramApp, triggerHaptic } from "../utils/telegram";
import { PRESET_AVATARS, compressImageToDataUrl } from "../shared/avatars";

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
    } catch (err: any) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#00f5d4] rounded-2xl p-4 sm:p-6 shadow-[0_0_40px_rgba(0,245,212,0.35)] flex flex-col gap-4 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#00f5d4]/30 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#00f5d4]" />
            <h2 className="font-pixel text-xs sm:text-sm text-[#00f5d4] uppercase tracking-wider">
              {profile.lang === "ru" ? "Регистрация Пилота" : "Pilot Registration"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#210b42] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-[#210b42]/80 border border-[#00f5d4]/40 rounded-xl p-3 flex items-center gap-3 text-xs text-gray-200 shadow-inner">
          <ShieldCheck className="w-6 h-6 text-[#00f5d4] shrink-0" />
          <p className="leading-snug">
            {profile.lang === "ru"
              ? "Зарегистрируйтесь, чтобы сохранить свой прогресс и попасть в Зал Славы (таблицу лидеров)!"
              : "Register to save your cosmic progress and compete on global leaderboards!"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3 bg-[#0b071e] p-3.5 rounded-xl border border-[#9d4edd]/30">
            <span className="font-pixel text-[10px] sm:text-xs text-[#00f5d4] uppercase">
              {profile.lang === "ru" ? "1. Фото профиля (Аватар)" : "1. Profile Photo (Avatar)"}
            </span>

            {/* Avatar Preview */}
            <div className="relative w-20 h-20 rounded-full border-2 border-[#00f5d4] bg-[#210b42] flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,245,212,0.4)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-[#00f5d4]" />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1"
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
                <button
                  type="button"
                  onClick={handleUseTelegramPhoto}
                  className="px-2.5 py-1.5 rounded-lg bg-[#210b42] border border-[#00f5d4]/50 text-[#00f5d4] hover:bg-[#00f5d4]/20 font-pixel flex items-center gap-1.5 transition-all"
                >
                  <Camera className="w-3 h-3" />
                  <span>{profile.lang === "ru" ? "Telegram фото" : "Telegram Photo"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-lg bg-[#210b42] border border-[#ffb703]/50 text-[#ffb703] hover:bg-[#ffb703]/20 font-pixel flex items-center gap-1.5 transition-all"
              >
                <Upload className="w-3 h-3" />
                <span>{profile.lang === "ru" ? "Загрузить фото" : "Upload Photo"}</span>
              </button>
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
                  className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm transition-all ${
                    selectedPresetId === p.id
                      ? "border-[#00f5d4] scale-110 shadow-[0_0_10px_#00f5d4]"
                      : "border-gray-700 hover:border-gray-500"
                  }`}
                  style={{ backgroundColor: `${p.color}20` }}
                  title={profile.lang === "ru" ? p.nameRu : p.nameEn}
                >
                  {p.badge}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname Section */}
          <div className="flex flex-col gap-2 bg-[#0b071e] p-3.5 rounded-xl border border-[#9d4edd]/30">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] sm:text-xs text-[#00f5d4] uppercase">
                {profile.lang === "ru" ? "2. Ваше Имя / Никнейм" : "2. Your Nickname"}
              </span>
              <span className="text-[9px] text-gray-400">
                {nickname.length}/20
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                maxLength={20}
                placeholder={profile.lang === "ru" ? "Введите никнейм..." : "Enter nickname..."}
                className={`w-full bg-[#120a2e] border-2 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 font-bold focus:outline-none transition-all pr-9 ${
                  isAvailable === true
                    ? "border-green-400 focus:shadow-[0_0_12px_rgba(74,222,128,0.4)]"
                    : isAvailable === false
                    ? "border-red-500 focus:shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "border-[#9d4edd]/50 focus:border-[#00f5d4]"
                }`}
              />
              <div className="absolute right-3 flex items-center">
                {checking ? (
                  <Loader2 className="w-4 h-4 text-[#00f5d4] animate-spin" />
                ) : isAvailable === true ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : isAvailable === false ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : null}
              </div>
            </div>

            {/* Quick Telegram Username Button */}
            {tgUsername && nickname !== tgUsername && (
              <button
                type="button"
                onClick={handleUseTelegramNickname}
                className="text-[10px] text-[#00f5d4] hover:underline self-start flex items-center gap-1 font-pixel mt-0.5"
              >
                <span>⚡ {profile.lang === "ru" ? "Использовать ник Telegram:" : "Use Telegram handle:"}</span>
                <strong className="text-white">@{tgUsername}</strong>
              </button>
            )}

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`text-[10px] flex items-center gap-1 font-pixel mt-1 ${
                  isAvailable === true
                    ? "text-green-400"
                    : isAvailable === false
                    ? "text-red-400"
                    : "text-gray-300"
                }`}
              >
                <span>{statusMessage}</span>
              </div>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500 text-red-300 text-xs text-center font-bold">
              {submitError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || checking || isAvailable === false || !validateFormat(nickname)}
              className={`w-full py-3.5 rounded-xl font-pixel text-xs font-bold uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                submitting || checking || isAvailable === false || !validateFormat(nickname)
                  ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-60"
                  : "bg-[#00f5d4] text-[#0b071e] hover:bg-[#00f5d4]/90 shadow-[0_0_20px_#00f5d4] cursor-pointer"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{profile.lang === "ru" ? "СОХРАНЕНИЕ..." : "SAVING..."}</span>
                </>
              ) : (
                <span>{profile.lang === "ru" ? "ЗАРЕГИСТРИРОВАТЬСЯ" : "REGISTER & SAVE"}</span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 text-[10px] text-gray-400 hover:text-white font-pixel text-center transition-colors"
            >
              {profile.lang === "ru" ? "Пропустить пока" : "Skip for now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
