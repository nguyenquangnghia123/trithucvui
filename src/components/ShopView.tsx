import React, { useState } from 'react';
import { UserProfile, ShopItem } from '../types';
import { SHOP_ITEMS } from '../data/shopItems';
import { StorageService } from '../services/storage';
import { soundManager } from '../services/sound';
import { ShoppingBag, Coins, Check, Sparkles, Shield, Heart, HelpCircle, Flame } from 'lucide-react';

interface ShopViewProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({ user, onUserUpdate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const categories = [
    { id: 'all', name: 'Tất Cả Vật Phẩm' },
    { id: 'character', name: 'Nhân Vật & Avatar' },
    { id: 'outfit', name: 'Trang Phục' },
    { id: 'frame', name: 'Khung Vinh Quang' },
    { id: 'background', name: 'Hình Nền Hồ Sơ' },
    { id: 'hint', name: 'Thẻ Gợi Ý' },
  ];

  const filteredItems = SHOP_ITEMS.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const handleBuy = (item: ShopItem) => {
    if (user.coins < item.price) {
      soundManager.playIncorrect();
      setFeedbackMsg({
        text: `Bạn còn thiếu ${(item.price - user.coins).toLocaleString()} xu để mua ${item.name}. Hãy tiếp tục trả lời đúng câu hỏi để kiếm xu nhé!`,
        isError: true,
      });
      return;
    }

    // Purchase successful
    soundManager.playCoin();
    const updatedUser: UserProfile = {
      ...user,
      coins: user.coins - item.price,
      inventory: [...user.inventory, item.id],
    };

    // Apply consumable effect immediately
    if (item.category === 'hint') {
      if (item.id === 'hint_triple') {
        updatedUser.hintsCount = (updatedUser.hintsCount || 0) + 3;
      } else {
        updatedUser.hintsCount = (updatedUser.hintsCount || 0) + 1;
      }
    }

    StorageService.saveUserProfile(updatedUser);
    onUserUpdate(updatedUser);

    setFeedbackMsg({
      text: `Chúc mừng! Bạn đã sở hữu thành công "${item.name}"!`,
      isError: false,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleEquip = (item: ShopItem) => {
    const updatedUser = { ...user };
    if (item.category === 'character') {
      updatedUser.avatar = item.preview || item.avatar || '🎒';
    } else if (item.category === 'frame') {
      updatedUser.avatarFrame = item.preview || item.avatarFrame || '👑';
    } else if (item.category === 'outfit') {
      updatedUser.equippedOutfit = item.id;
    } else if (item.category === 'background') {
      updatedUser.equippedBackground = item.id;
    }

    soundManager.playLevelUp();
    StorageService.saveUserProfile(updatedUser);
    onUserUpdate(updatedUser);

    setFeedbackMsg({
      text: `Đã trang bị "${item.name}" vào hồ sơ của bạn!`,
      isError: false,
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 sm:p-8 rounded-3xl text-white shadow-xl shadow-teal-600/15 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-white/20 text-2xl">🛒</span>
            <h1 className="text-xl sm:text-2xl font-black">
              Cửa Hàng Học Đường Tri Thức
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-xl leading-relaxed">
            Quy đổi Xu kiếm được từ việc trả lời đúng các câu hỏi để sắm trang phục, mở khóa avatar và nhận vật phẩm trợ chiến!
          </p>
          <div className="text-[11px] font-bold text-amber-300 bg-black/20 inline-block px-3 py-1 rounded-xl">
            ✨ Tự hào 100% rèn luyện bằng kiến thức thật • Tuyệt đối không dùng tiền thật
          </div>
        </div>

        {/* Current Coin Balance Card */}
        <div className="bg-black/25 backdrop-blur-md p-4 rounded-2xl border border-white/20 min-w-[190px] text-center">
          <div className="text-xs text-emerald-200 font-semibold">Túi Xu Hiện Có</div>
          <div className="text-2xl font-black text-amber-300 flex items-center justify-center gap-1.5 mt-0.5">
            🪙 {user.coins.toLocaleString()} Xu
          </div>
          <div className="text-[11px] text-white/80 mt-1">
            {user.hintsCount} Thẻ gợi ý sẵn sàng
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between border ${
            feedbackMsg.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === cat.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => {
          const isOwned = user.inventory.includes(item.id);
          const isEquippedAvatar = item.category === 'character' && user.avatar === item.preview;
          const isEquippedFrame = item.category === 'frame' && user.avatarFrame === item.preview;
          const isEquippedOutfit = item.category === 'outfit' && user.equippedOutfit === item.id;
          const isEquippedBg = item.category === 'background' && user.equippedBackground === item.id;
          const isEquipped = isEquippedAvatar || isEquippedFrame || isEquippedOutfit || isEquippedBg;

          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl sm:text-4xl p-2 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {item.preview || item.icon || '🎁'}
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    🪙 {item.price} Xu
                  </span>
                </div>

                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                {isEquipped ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                    Đang Trang Bị
                  </button>
                ) : isOwned ? (
                  item.category === 'hint' ? (
                    <button
                      onClick={() => handleBuy(item)}
                      className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Mua Thêm (🪙 {item.price})
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEquip(item)}
                      className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      Trang Bị Ngay
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleBuy(item)}
                    className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                    Mua Bằng Xu
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
