import { useEffect, useRef, useState } from 'react'
import {
  getMediaAlbum,
  validMetadata,
  writeMedia,
  type MediaAction,
  type MediaAlbum,
  type MediaMetadata,
  type MediaOwner,
} from '../../api/adminMedia'
import { getSessionVersion } from '../../state/accessToken'
import { CatalogImage } from '../media/CatalogImage'
import { adminErrorMessage, type AdminMutation } from './useAdminMutation'

const emptyMetadata = { altText: '', source: '', rightsRecord: '' }
type Operation = MediaAction['kind']
const operationLabels: Record<Operation, string> = {
  upload: '사진 추가',
  metadata: '설명·출처·사용권 수정',
  representative: '대표 지정',
  order: '전체 순서 변경',
  replace: '파일 교체',
  delete: '사진 삭제',
}

/** Shares the page write gate. Every failure requires a fresh ADMIN GET and explicit review. */
export function MediaManager({
  owner,
  verified,
  mutation,
  setBlocked,
}: {
  owner: MediaOwner
  verified: boolean
  mutation: AdminMutation
  setBlocked: (blocked: boolean) => void
}) {
  const [album, setAlbum] = useState<MediaAlbum>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [phase, setPhase] = useState<'ready' | 'pending' | 'failed'>('ready')
  const [fresh, setFresh] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [lastAction, setLastAction] = useState('')
  const gate = useRef(false)
  const reads = useRef(0)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  async function refresh() {
    if (loading || phase === 'pending' || !verified) return
    const sequence = ++reads.current
    const version = getSessionVersion()
    const signal = lifetime.current!.signal
    setLoading(true)
    setFresh(false)
    setReviewed(false)
    setError(undefined)
    try {
      const result = await getMediaAlbum(owner, signal)
      if (signal.aborted || version !== getSessionVersion() || reads.current !== sequence) return
      setAlbum(result)
      setFresh(true)
      if (phase === 'ready') setFormKey((key) => key + 1)
    } catch (next) {
      if (!signal.aborted && version === getSessionVersion() && reads.current === sequence)
        setError(next)
    } finally {
      if (!signal.aborted && version === getSessionVersion() && reads.current === sequence)
        setLoading(false)
    }
  }
  function save(action: MediaAction) {
    if (!verified || !album || !fresh || loading || gate.current || mutation.disabled) return
    gate.current = true
    ++reads.current
    setBlocked(true)
    setPhase('pending')
    setFresh(false)
    setReviewed(false)
    setError(undefined)
    setLastAction(
      `${owner.type === 'ROOM' ? '객실' : '숙소'} #${owner.id} · ${operationLabels[action.kind]}${'mediaId' in action ? ` · 사진 #${action.mediaId}` : ''}`,
    )
    void mutation.run(
      async (signal) => {
        const version = getSessionVersion()
        try {
          await writeMedia(owner, album, action, signal)
          // A write response is not the next write's authority: obtain a fresh ADMIN GET/ETag.
          return await getMediaAlbum(owner, signal)
        } catch (next) {
          if (!signal.aborted && version === getSessionVersion()) {
            setError(next)
            setPhase('failed')
          }
          throw next
        }
      },
      (result) => {
        setAlbum(result)
        setFresh(true)
        setPhase('ready')
        setBlocked(false)
        gate.current = false
        setFormKey((key) => key + 1)
      },
      '사진 작업을 반영하고 최신 관리 목록을 조회했습니다.',
    )
  }
  const disabled = !verified || loading || mutation.disabled || phase !== 'ready' || !fresh
  return (
    <section id="catalog-media-management" className="admin-media" aria-label="사진 관리">
      <h3>사진 관리</h3>
      <p>
        {owner.type === 'ROOM' ? '객실' : '숙소'} #{owner.id}의 사진만 관리합니다. 최대 20장 ·
        JPEG/PNG 10MiB 이하.
      </p>
      <button
        type="button"
        disabled={!verified || loading || phase === 'pending' || mutation.pending}
        onClick={() => void refresh()}
      >
        사진 관리 목록 새로 조회
      </button>
      {loading && <p role="status">사진 목록을 확인하고 있습니다.</p>}
      {phase === 'pending' && (
        <div role="status">
          <progress aria-label="사진 작업 진행 중" /> 업로드·저장 및 결과 조회 중입니다. 자동
          재전송하지 않습니다.
        </div>
      )}
      {error !== undefined && <p role="alert">{adminErrorMessage(error)}</p>}
      {lastAction && <p>직전 요청: {lastAction}</p>}
      {phase === 'failed' && (
        <section className="admin-recovery-panel" aria-label="사진 작업 결과 확인">
          <p>
            작업이 일부 반영되었을 수 있습니다. 같은 대상의 사진 관리 목록을 새로 조회하고
            ID·사진·순서·출처를 확인하세요. 파일의 물리 삭제 완료를 의미하지 않습니다.
          </p>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={!fresh || loading}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            새로 조회한 사진 작업 결과를 확인했습니다.
          </label>
          <button
            type="button"
            disabled={!fresh || loading || !reviewed}
            onClick={() => {
              mutation.resetAfterReview()
              gate.current = false
              setPhase('ready')
              setBlocked(false)
              setReviewed(false)
              setFormKey((key) => key + 1)
            }}
          >
            사진 결과 확인 후 새 작업 준비
          </button>
        </section>
      )}
      {album && (
        <>
          <h4>등록된 사진 · {album.images.length}장</h4>
          <ol className="admin-media-list" aria-label="관리 사진 목록">
            {album.images.map(({ image, source, rightsRecord }, i) => (
              <li key={image.mediaId}>
                <CatalogImage image={image} />
                <p>
                  사진 #{image.mediaId} · 순서 {i + 1}
                  {i === 0 ? ' · 대표' : ''}
                </p>
                <p>{image.altText}</p>
                <p>출처: {source}</p>
                <p>사용권: {rightsRecord}</p>
              </li>
            ))}
          </ol>
          {!album.images.length && <p>등록된 사진이 없습니다.</p>}
          <details className="admin-disclosure">
            <summary>사진 작업 준비</summary>
            <MediaForm key={formKey} album={album} disabled={disabled} onSave={save} />
          </details>
        </>
      )}
    </section>
  )
}

function MediaForm({
  album,
  disabled,
  onSave,
}: {
  album: MediaAlbum
  disabled: boolean
  onSave: (action: MediaAction) => void
}) {
  const [operation, setOperation] = useState<Operation>('upload')
  const [mediaId, setMediaId] = useState(album.images[0]?.image.mediaId ?? 0)
  const [metadata, setMetadata] = useState<MediaMetadata>(emptyMetadata)
  const [file, setFile] = useState<File>()
  const [order, setOrder] = useState(album.images.map((item) => item.image.mediaId))
  const [ack, setAck] = useState(false)
  const [error, setError] = useState('')
  const needsMetadata = ['upload', 'metadata', 'replace'].includes(operation)
  const needsFile = operation === 'upload' || operation === 'replace'
  function select(nextOperation: Operation, id: number) {
    setOperation(nextOperation)
    setMediaId(id)
    setFile(undefined)
    setAck(false)
    setError('')
    const item = album.images.find((row) => row.image.mediaId === id)
    setMetadata(
      nextOperation !== 'upload' && item
        ? { altText: item.image.altText, source: item.source, rightsRecord: item.rightsRecord }
        : emptyMetadata,
    )
  }
  return (
    <form
      className="admin-form"
      aria-label="사진 작업"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        const trimmed = {
          altText: metadata.altText.trim(),
          source: metadata.source.trim(),
          rightsRecord: metadata.rightsRecord.trim(),
        }
        if (!ack) {
          setError('대상과 작업·사용권을 확인하고 동의해 주세요.')
          return
        }
        if (needsMetadata && !validMetadata(trimmed)) {
          setError('대체 텍스트·출처·사용권을 모두 입력하세요.')
          return
        }
        if (
          needsFile &&
          (!file ||
            !file.size ||
            file.size > 10 * 1024 * 1024 ||
            !['image/jpeg', 'image/png'].includes(file.type))
        ) {
          setError('JPEG/PNG 파일을 10MiB 이하로 선택하세요.')
          return
        }
        if (operation === 'upload') onSave({ kind: operation, file: file!, metadata: trimmed })
        else if (operation === 'replace')
          onSave({ kind: operation, mediaId, file: file!, metadata: trimmed })
        else if (operation === 'metadata') onSave({ kind: operation, mediaId, metadata: trimmed })
        else if (operation === 'order') onSave({ kind: operation, mediaIds: order })
        else onSave({ kind: operation, mediaId })
      }}
    >
      <fieldset disabled={disabled} onChange={() => setAck(false)}>
        <legend>사진 작업 준비</legend>
        <div className="form-field">
          <label htmlFor="media-operation">사진 작업 종류</label>
          <select
            id="media-operation"
            value={operation}
            onChange={(e) => select(e.target.value as Operation, mediaId)}
          >
            <option value="upload" disabled={album.images.length >= 20}>
              사진 추가
            </option>
            <option value="metadata" disabled={!album.images.length}>
              설명·출처·사용권 수정
            </option>
            <option value="representative" disabled={!album.images.length}>
              대표 지정
            </option>
            <option value="order" disabled={!album.images.length}>
              전체 순서 변경
            </option>
            <option value="replace" disabled={!album.images.length}>
              파일 교체 (새 사진 ID)
            </option>
            <option value="delete" disabled={!album.images.length}>
              사진 삭제
            </option>
          </select>
        </div>
        {!['upload', 'order'].includes(operation) && (
          <div className="form-field">
            <label htmlFor="media-target">작업할 사진</label>
            <select
              id="media-target"
              value={mediaId}
              onChange={(e) => select(operation, Number(e.target.value))}
            >
              {album.images.map((item) => (
                <option key={item.image.mediaId} value={item.image.mediaId}>
                  #{item.image.mediaId} · {item.image.altText}
                </option>
              ))}
            </select>
          </div>
        )}
        {operation === 'delete' && (
          <p className="admin-media-delete-note">
            선택한 사진만 목록에서 삭제합니다. 숙소·객실과 예약은 삭제되지 않습니다.
          </p>
        )}
        {operation === 'order' && (
          <ol aria-label="변경할 사진 순서">
            {order.map((id, i) => (
              <li key={id}>
                #{id}
                {i === 0 ? ' · 대표' : ''}{' '}
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...order]
                    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                    setOrder(next)
                    setAck(false)
                  }}
                >
                  사진 #{id} 앞으로
                </button>
              </li>
            ))}
          </ol>
        )}
        {needsFile && (
          <div className="form-field">
            <label htmlFor="media-file">JPEG/PNG 파일</label>
            <input
              key={`${operation}-${mediaId}`}
              id="media-file"
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            <small>가로·세로 8192px 이하, 1600만 픽셀 이하. 서버가 실제 이미지를 검증합니다.</small>
          </div>
        )}
        {needsMetadata &&
          (['altText', 'source', 'rightsRecord'] as const).map((key, i) => (
            <div className="form-field" key={key}>
              <label htmlFor={`media-${key}`}>
                {['사진 대체 텍스트', '사진 출처', '사진 사용권 근거'][i]}
              </label>
              <textarea
                id={`media-${key}`}
                value={metadata[key]}
                maxLength={[300, 500, 1000][i]}
                onChange={(e) => setMetadata({ ...metadata, [key]: e.target.value })}
              />
            </div>
          ))}
        <label className="admin-check">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => {
              e.stopPropagation()
              setAck(e.target.checked)
            }}
          />
          대상·작업·사진 사용권을 확인했으며 한 번 제출합니다.
        </label>
        <button
          type="submit"
          className={operation === 'delete' ? 'admin-media-delete' : undefined}
          disabled={operation === 'upload' && album.images.length >= 20}
        >
          사진 작업 실행
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
