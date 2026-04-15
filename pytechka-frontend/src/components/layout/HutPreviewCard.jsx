import { useEffect, useRef } from 'react'

const styles = {
  backdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
  },
  cardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 'max(96px, calc(env(safe-area-inset-bottom, 0px) + 72px))',
    zIndex: 30,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    background: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(148,163,184,0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    zIndex: 2,
  },
  content: {
    padding: 18,
    position: 'relative',
  },
  tagLayer: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 600,
    background: 'rgba(34, 197, 94, 0.2)', // Green tinted
    color: '#4ade80',
  },
  contactsBtn: {
    background: '#3b82f6',
    border: 'none',
    width: '100%',
    borderRadius: 14,
    color: '#fff',
    fontWeight: 700,
    padding: '12px',
    cursor: 'pointer',
    marginTop: 12,
  }
}

export default function HutPreviewCard({
  hut,
  onClose,
  bottomOffset
}) {
  const cardRef = useRef(null)

  useEffect(() => {
    if (!hut) return
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [hut, onClose])

  if (!hut) return null

  let processedDesc = hut?.description || ''
  if (processedDesc) {
     const headers = ['Местоположение', 'GPS', 'Описание', 'Изходни пунктове', 'Изходен пункт', 'Съседни туристически обекти', 'Съседни обекти', 'Съседен обект', 'Стопанин']
     headers.forEach(h => {
        const re = new RegExp(`(${h}\\s*[:\\-]?\\s*)`, 'gi')
        processedDesc = processedDesc.replace(re, '||SPLIT||$1')
     })
  }

  const descriptionPoints = processedDesc
    .split(/(?:\|\|SPLIT\|\||\n)/)
    .map(s => s.trim())
    .filter(s => s.length > 5)

  return (
    <>
      <div style={styles.backdrop} aria-hidden="true" />
      <div
        ref={cardRef}
        style={{
          ...styles.cardWrap,
          ...(bottomOffset ? { bottom: bottomOffset } : {}),
        }}
      >
        <div style={styles.card}>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close hut preview"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          <div style={styles.content}>
            <div style={styles.tagLayer}>
               <span style={styles.tag}>Mountain Hut</span>
               {hut.averageRating > 0 && (
                  <span style={{...styles.tag, background: 'rgba(234, 179, 8, 0.2)', color: '#facc15'}}>
                     ★ {hut.averageRating.toFixed(1)}
                  </span>
               )}
            </div>

            <h2
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: 20,
                lineHeight: 1.2,
              }}
            >
              {hut.name}
            </h2>
            
            {hut.elevation ? (
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                Elevation: {hut.elevation} m
              </p>
            ) : null}

            <div 
              style={{ 
                color: '#cbd5e1', 
                fontSize: 13, 
                marginTop: 12, 
                lineHeight: 1.5, 
                maxHeight: '45vh', 
                overflowY: 'auto', 
                paddingRight: 10,
                paddingBottom: 4
              }}
              className="hut-scroll-container"
            >
              <style>{`
                .hut-scroll-container::-webkit-scrollbar {
                  width: 6px;
                }
                .hut-scroll-container::-webkit-scrollbar-track {
                  background: rgba(255,255,255,0.05);
                  border-radius: 8px;
                }
                .hut-scroll-container::-webkit-scrollbar-thumb {
                  background: rgba(255,255,255,0.25);
                  border-radius: 8px;
                }
              `}</style>

              {descriptionPoints.length > 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {descriptionPoints.map((pt, i) => {
                       // Clean up trailing dots if they exist, except if it's supposed to end with it.
                       let text = pt;
                       if(!text.endsWith('.') && !text.endsWith('!')) text += '.';
                       
                       // Bold the label before the colon if exists
                       const colonIndex = text.indexOf(':');
                       if (colonIndex > 0 && colonIndex < 35) {
                          const label = text.substring(0, colonIndex + 1);
                          const rest = text.substring(colonIndex + 1);
                          return (
                            <div key={i}>
                              <strong style={{ color: '#fff' }}>{label}</strong>{rest}
                            </div>
                          )
                       }
                       
                       return <div key={i}>{text}</div>
                    })}
                 </div>
              ) : (
                 <p>No description available.</p>
              )}
            </div>

            {hut.contacts && (
               <button style={styles.contactsBtn} onClick={() => alert(hut.contacts)}>
                 View Contacts
               </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
