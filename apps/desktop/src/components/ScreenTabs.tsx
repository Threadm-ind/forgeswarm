import type { Screen } from "../App";

const screens: Screen[] = ["Home", "Swarm Setup", "Workspace", "Merge Queue", "Settings"];

const screenIcons: Record<Screen, string> = {
  "Home": "⌂",
  "Swarm Setup": "⚡",
  "Workspace": "▣",
  "Merge Queue": "⇄",
  "Settings": "⚙"
};

export function SideNav({
  activeScreen,
  onSelect
}: {
  activeScreen: Screen;
  onSelect: (screen: Screen) => void;
}) {
  return (
    <nav className="flex w-[180px] shrink-0 flex-col border-r border-[#3c3c3c] bg-[#252526]">
      <div className="border-b border-[#3c3c3c] px-4 py-2.5">
        <p className="text-[10px] uppercase tracking-widest text-[#858585]">Explorer</p>
      </div>
      <div className="flex flex-col py-1">
        {screens.map((screen) => (
          <button
            key={screen}
            className={`flex w-full items-center gap-2.5 py-1.5 pl-3 pr-4 text-left text-[13px] transition-colors ${
              activeScreen === screen
                ? "border-l-2 border-[#007acc] bg-[#37373d] text-[#cccccc]"
                : "border-l-2 border-transparent text-[#858585] hover:bg-[#2a2d2e] hover:text-[#cccccc]"
            }`}
            onClick={() => onSelect(screen)}
            type="button"
          >
            <span className="w-4 text-center text-sm leading-none opacity-70">
              {screenIcons[screen]}
            </span>
            <span>{screen}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
