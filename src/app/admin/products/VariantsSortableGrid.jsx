"use client";

import { useState, memo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cloudinaryThumb } from "@/app/lib/cloudinary";
import styles from "./products.module.css";

/* ── Carte variante draggable ── */
const SortableVariantCard = memo(function SortableVariantCard({ variant, index, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variant._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex:  isDragging ? 10 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.variantCard}>
      <div className={styles.dragHandle} {...attributes} {...listeners} title="Déplacer">
        <span className={styles.dragDots}>⠿</span>
        {index === 0 && <span className={styles.firstBadge}>Affiché en 1er</span>}
      </div>

      <div className={styles.variantImgWrap}>
        {variant.image
          ? <img src={cloudinaryThumb(variant.image, 400)} alt={variant.colorName} className={styles.variantImg} />
          : <div className={styles.variantImgPlaceholder} style={{ backgroundColor: variant.colorCode }} />
        }
      </div>

      <div className={styles.variantInfo}>
        <span className={styles.variantName}>{variant.colorName}</span>
        <div className={styles.variantSwatch} style={{ backgroundColor: variant.colorCode }} title={variant.colorCode} />
      </div>

      <div className={styles.stockRow}>
        <span
          className={`${styles.stockBadge} ${
            variant.stock === 0 ? styles.stockBadgeZero : variant.stock <= 3 ? styles.stockBadgeLow : ""
          }`}
        >
          {variant.stock === 0 ? "Rupture de stock" : `${variant.stock} / ${variant.editionSize ?? 50} en stock`}
        </span>
      </div>

      <div className={styles.previewBtnWrap}>
        <button
          className={styles.previewBtnSmall}
          style={{ backgroundColor: variant.colorCode, color: variant.textColor }}
        >
          Commander
        </button>
      </div>

      <div className={styles.variantActions}>
        <button
          className={styles.btnEdit}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onEdit(variant)}
        >
          Modifier
        </button>
        <button
          className={styles.btnDelete}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onDelete(variant._id, variant.colorName)}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
});

/* ── Grille triable par glisser-déposer ── */
export default function VariantsSortableGrid({ variants, onEdit, onDelete, onReorder }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = variants.findIndex(v => v._id === active.id);
    const newIndex = variants.findIndex(v => v._id === over.id);
    onReorder(arrayMove(variants, oldIndex, newIndex));
  };

  const activeVariant = variants.find(v => v._id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={variants.map(v => v._id)}
        strategy={rectSortingStrategy}
      >
        <div className={styles.variantsGrid}>
          {variants.map((v, i) => (
            <SortableVariantCard
              key={v._id}
              variant={v}
              index={i}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeVariant && (
          <div className={`${styles.variantCard} ${styles.draggingOverlay}`}>
            <div className={styles.variantImgWrap}>
              {activeVariant.image
                ? <img src={cloudinaryThumb(activeVariant.image, 400)} alt={activeVariant.colorName} className={styles.variantImg} />
                : <div className={styles.variantImgPlaceholder} style={{ backgroundColor: activeVariant.colorCode }} />
              }
            </div>
            <div className={styles.variantInfo}>
              <span className={styles.variantName}>{activeVariant.colorName}</span>
              <div className={styles.variantSwatch} style={{ backgroundColor: activeVariant.colorCode }} />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
