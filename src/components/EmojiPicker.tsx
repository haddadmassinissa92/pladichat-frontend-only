"use client";

import { useState } from "react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
      "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
      "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
      "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳",
      "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️",
      "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤",
      "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱",
      "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫",
      "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦",
      "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵",
      "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕",
    ],
  },
  {
    label: "👍",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
      "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️",
      "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👂",
    ],
  },
  {
    label: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️",
      "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣",
      "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "🔥", "✨",
    ],
  },
  {
    label: "🐶",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
      "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤",
      "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄",
      "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦗", "🕷️",
    ],
  },
  {
    label: "🍎",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
      "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🌽",
      "🍕", "🍔", "🍟", "🌭", "🥪", "🌮", "🌯", "🥗",
      "🍿", "🍩", "🍪", "🎂", "🍰", "🧁", "🍫", "🍬",
      "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🥂", "🍾",
    ],
  },
  {
    label: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱",
      "🏓", "🏸", "🥊", "🥋", "⛳", "⛸️", "🎣", "🤿",
      "🎽", "🎿", "🛹", "🎯", "🎮", "🎲", "🧩", "🎨",
      "🎬", "🎤", "🎧", "🎸", "🎹", "🥁", "🎺", "🎻",
    ],
  },
  {
    label: "🚗",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🏎️", "🚓", "🚑", "🚒",
      "🚲", "🛵", "🏍️", "✈️", "🚀", "🛸", "🚁", "⛵",
      "🌍", "🌎", "🌏", "🗺️", "🏔️", "🌋", "🏖️", "🏝️",
      "🌙", "⭐", "🌟", "☀️", "⛅", "☁️", "🌧️", "⛈️",
      "❄️", "☃️", "🌈", "🎉", "🎊", "🎁", "🏆", "🥇",
    ],
  },
];

export default function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
      {/* Onglets de catégories, avec un indicateur clair pour la catégorie active */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 px-1">
        {EMOJI_CATEGORIES.map((cat, index) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveCategory(index)}
            className={`flex-1 text-lg py-2 my-1 rounded-lg transition ${
              activeCategory === index
                ? "bg-indigo-50 dark:bg-indigo-950 grayscale-0"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800 grayscale opacity-60 hover:opacity-100"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grille des emojis de la catégorie active, avec la scrollbar fine commune à l'app */}
      <div className="custom-scrollbar grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="text-xl leading-none aspect-square flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
