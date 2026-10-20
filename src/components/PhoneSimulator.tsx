"use client";

import { useRef, useState, MouseEvent } from 'react';

export function PhoneSimulator({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const onMouseDown = (e: MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartY(e.pageY - scrollRef.current.offsetTop);
    setScrollTop(scrollRef.current.scrollTop);
  };

  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const y = e.pageY - scrollRef.current.offsetTop;
    const walk = (y - startY) * 1.5; // Drag speed multiplier
    scrollRef.current.scrollTop = scrollTop - walk;
  };

  return (
    <div 
      ref={scrollRef}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      className={`flex-1 overflow-y-auto overflow-x-hidden relative w-full h-full no-scrollbar ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        // Prevents text selection while dragging
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 
        This div prevents child click events from firing if the user is currently dragging 
      */}
      <div className={`min-h-[100%] h-max flex flex-col ${isDragging ? "pointer-events-none" : ""}`}>
        {children}
      </div>
      
      {/* Injecting CSS to hide the scrollbar for this specific component */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* Custom circle cursor to mimic Chrome devtools touch */
        .cursor-grab { cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="rgba(0,0,0,0.4)" border="1px solid white"/></svg>') 16 16, auto; }
        .cursor-grabbing { cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="rgba(0,0,0,0.6)" border="1px solid white"/></svg>') 16 16, auto; }
      `}} />
    </div>
  );
}
