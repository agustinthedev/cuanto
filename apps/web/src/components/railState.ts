export function getRailScrollState(scrollLeft: number, clientWidth: number, scrollWidth: number) {
  return {
    canScrollLeft: scrollLeft > 4,
    canScrollRight: scrollLeft + clientWidth < scrollWidth - 4,
  };
}
