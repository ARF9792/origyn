"use client";

import { useEffect } from "react";

export default function LandingMotion() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal")
    );

    if (!elements.length) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      elements.forEach((el) => {
        el.classList.add("reveal-visible");
      });

      return;
    }

    elements.forEach((el) => {
      el.classList.add("reveal-ready");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;

          requestAnimationFrame(() => {
            element.classList.add("reveal-visible");
          });

          observer.unobserve(element);
        });
      },
      {
        threshold: 0.08,

        /*
         * Trigger slightly before the element
         * reaches the center of the viewport.
         */
        rootMargin: "0px 0px -10% 0px",
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}