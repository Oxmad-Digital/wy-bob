"use client";

import { useState } from "react";
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
import styles from "./gallery-admin.module.css";

/* ── Carte photo draggable ── */
function SortablePhoto({ photo, index, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.photoCard}>
      {/* Poignée drag */}
      <div className={styles.dragHandle} {...attributes} {...listeners} title="Déplacer">
        <span className={styles.dragDots}>⠿</span>
      </div>
      <div className={styles.photoImgWrap}>
        <img src={cloudinaryThumb(photo.url, 360)} alt={`Photo galerie ${index + 1}`} className={styles.photoImg} />
      </div>
      <div className={styles.photoActions}>
        <button
          className={styles.btnDelete}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onDelete(photo)}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

/* ── Grille triable par glisser-déposer ── */
export default function PhotosSortableGrid({ photos, onDelete, onReorder }) {
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
    const oldIndex = photos.findIndex(p => p._id === active.id);
    const newIndex = photos.findIndex(p => p._id === over.id);
    onReorder(arrayMove(photos, oldIndex, newIndex));
  };

  const activePhoto = photos.find(p => p._id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={photos.map(p => p._id)} strategy={rectSortingStrategy}>
        <div className={styles.photosGrid}>
          {photos.map((photo, i) => (
            <SortablePhoto
              key={photo._id}
              photo={photo}
              index={i}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>

      {/* Aperçu flottant pendant le drag */}
      <DragOverlay>
        {activePhoto && (
          <div className={`${styles.photoCard} ${styles.photoCardDragging}`}>
            <div className={styles.photoImgWrap}>
              <img src={cloudinaryThumb(activePhoto.url, 360)} alt="" className={styles.photoImg} />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
