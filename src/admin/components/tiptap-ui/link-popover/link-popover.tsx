import { useAdminI18n } from '../../../i18n';
"use client"

import { forwardRef, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/tiptap-icons/corner-down-left-icon"
import { ExternalLinkIcon } from "@/components/tiptap-icons/external-link-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { TrashIcon } from "@/components/tiptap-icons/trash-icon"

// --- Tiptap UI ---
import type { UseLinkPopoverConfig } from "@/components/tiptap-ui/link-popover"
import { useLinkPopover } from "@/components/tiptap-ui/link-popover"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/tiptap-ui-primitive/popover"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import {
  Card,
  CardBody,
  CardItemGroup,
} from "@/components/tiptap-ui-primitive/card"
import { Input } from "@/components/tiptap-ui-primitive/input"
import { ButtonGroup } from "@/components/tiptap-ui-primitive/button-group"

import { PageLinksContext } from '../../../page-links';
import { documentHeadings, publicPageUrl, type HeadingTarget } from '../../../../documents/links';
import "./link-popover.scss"

export interface LinkMainProps {
  documentId: string | null
  setDocumentId: React.Dispatch<React.SetStateAction<string | null>>
  anchor: string | null
  setAnchor: React.Dispatch<React.SetStateAction<string | null>>
  /**
   * The URL to set for the link.
   */
  url: string
  /**
   * Function to update the URL state.
   */
  setUrl: React.Dispatch<React.SetStateAction<string | null>>
  /**
   * Function to set the link in the editor.
   */
  setLink: () => void
  /**
   * Function to remove the link from the editor.
   */
  removeLink: () => void
  /**
   * Function to open the link.
   */
  openLink: () => void
  /**
   * Whether the link is currently active in the editor.
   */
  isActive: boolean
}

export interface LinkPopoverProps
  extends Omit<ButtonProps, "type">, UseLinkPopoverConfig {
  /**
   * Callback for when the popover opens or closes.
   */
  onOpenChange?: (isOpen: boolean) => void
  /**
   * Whether to automatically open the popover when a link is active.
   * @default false
   */
  autoOpenOnLinkActive?: boolean
}

/**
 * Link button component for triggering the link popover
 */
export const LinkButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
  const { t } = useAdminI18n();
    return (
      <Button
        type="button"
        className={className}
        variant="ghost"
        role="button"
        tabIndex={-1}
        aria-label={t("Link")}
        tooltip={t("Link")}
        ref={ref}
        {...props}
      >
        {children || <LinkIcon className="tiptap-button-icon" />}
      </Button>
    )
  }
)

LinkButton.displayName = "LinkButton"

/**
 * Main content component for the link popover
 */
const LinkMain: React.FC<LinkMainProps> = ({
  url,
  setUrl,
  setLink,
  removeLink,
  openLink,
  isActive, documentId, setDocumentId, anchor, setAnchor,
}) => {
  const { t } = useAdminI18n();
  const isMobile = useIsBreakpoint()
  const links = useContext(PageLinksContext)
  const [mode, setMode] = useState<'page' | 'url'>(documentId || links && !url ? 'page' : 'url')
  const [search, setSearch] = useState('')
  const [headings, setHeadings] = useState<HeadingTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (documentId) setMode('page'); else if (isActive) setMode('url') }, [documentId, isActive])
  useEffect(() => {
    let active = true
    setHeadings([]); setError('')
    if (!documentId || !links) { setLoading(false); return }
    setLoading(true)
    links.loadPage(documentId).then((page) => {
      if (!active) return
      setHeadings(documentHeadings(page.content).filter((heading) => heading.level >= 1 && heading.level <= 6 && heading.id))
    }).catch(() => { if (active) setError(t('Unable to load link target.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [documentId, links, t])
  const target = links?.pages.find((page) => page.id === documentId)
  useEffect(() => {
    if (target) setUrl(`${publicPageUrl(target.path, target.locale)}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`)
  }, [target?.path, target?.locale, documentId, anchor, setUrl])
  const canApply = !!url && (mode === 'url' || !!target && !loading && !error && (!anchor || headings.some((heading) => heading.id === anchor)))
  const chooseAnchor = (value: string) => setAnchor(value || null)
  const openTarget = () => {
    if (target) window.open(`/admin/preview/${target.id}?locale=${encodeURIComponent(target.locale)}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`, '_blank', 'noopener,noreferrer')
    else openLink()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      if (canApply) setLink()
    }
  }

  return (
    <Card className="cms-link-card"
      style={{
        ...(isMobile ? { boxShadow: "none", border: 0 } : {}),
      }}
    >
      <CardBody
        style={{
          ...(isMobile ? { padding: 0 } : {}),
        }}
      >
        {links && <div className="cms-link-picker">
          <label>{t('Link destination')}<select aria-label={t('Link destination')} value={mode} onChange={(event) => {
            const mode = event.target.value === 'page' ? 'page' : 'url'
            setMode(mode)
            if (mode === 'url') { setDocumentId(null); setAnchor(null) }
          }}><option value="url">URL</option><option value="page">{t('Page')}</option></select></label>
          {mode === 'page' && <>
            <input aria-label={t('Search pages')} placeholder={t('Search pages')} value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>{t('Page')}<select aria-label={t('Page')} value={documentId ?? ''} onChange={(event) => { setDocumentId(event.target.value || null); setAnchor(null); setUrl('') }}>
              <option value="">{t('Select a page')}</option>
              {documentId && !target && <option value={documentId}>{t('Link target unavailable')}</option>}
              {links.pages.filter((page) => page.id === documentId || `${page.title} ${page.path}`.toLowerCase().includes(search.toLowerCase())).map((page) => <option key={page.id} value={page.id}>{page.title} /{page.path}/{page.draft ? ` (${t('Draft')})` : ''}</option>)}
            </select></label>
            <label>{t('Heading')}<select aria-label={t('Heading')} value={anchor ?? ''} disabled={!target || loading} onChange={(event) => chooseAnchor(event.target.value)}>
              <option value="">{t('Page top')}</option>
              {anchor && !headings.some((heading) => heading.id === anchor) && <option value={anchor}>{t('Link target unavailable')}</option>}
              {headings.map((heading) => <option key={heading.id} value={heading.id}>H{heading.level} {heading.text}</option>)}
            </select></label>
            {error && <p role="alert">{error}</p>}
          </>}
        </div>}
        {mode === 'page' && url && <p className="cms-link-destination">{url.replace(/(?:%[0-9a-f]{2})+/gi, (part) => { try { return decodeURI(part) } catch { return part } })}</p>}
        <CardItemGroup orientation="horizontal">
          {mode === 'url' && <Input
            type="text"
            placeholder={t("Paste a link...")}
            value={url}
            onChange={(e) => { setDocumentId(null); setAnchor(null); setUrl(e.target.value) }}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="tiptap-link-input"
          />}

          <ButtonGroup>
            <Button
              type="button"
              onClick={setLink}
              title={t("Apply link")}
              disabled={!canApply}
              variant={mode === 'page' ? 'primary' : 'ghost'}
            >
              {mode === 'page' && <span className="tiptap-button-text">{t("Apply link")}</span>}
              <CornerDownLeftIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>

          <Separator />

          <ButtonGroup>
            <ButtonGroup>
              <Button
                type="button"
                onClick={openTarget}
                title="Open in new window"
                disabled={!canApply}
                variant="ghost"
              >
                <ExternalLinkIcon className="tiptap-button-icon" />
              </Button>
            </ButtonGroup>

            <ButtonGroup>
              <Button
                type="button"
                onClick={removeLink}
                title={t("Remove link")}
                disabled={!isActive}
                variant="ghost"
              >
                <TrashIcon className="tiptap-button-icon" />
              </Button>
            </ButtonGroup>
          </ButtonGroup>
        </CardItemGroup>
      </CardBody>
    </Card>
  )
}

/**
 * Link content component for standalone use
 */
export const LinkContent: React.FC<{
  editor?: Editor | null
}> = ({ editor }) => {
  const linkPopover = useLinkPopover({
    editor,
  })

  return <LinkMain {...linkPopover} />
}

/**
 * Link popover component for Tiptap editors.
 *
 * For custom popover implementations, use the `useLinkPopover` hook instead.
 */
export const LinkPopover = forwardRef<HTMLButtonElement, LinkPopoverProps>(
  (
    {
      editor: providedEditor,
      hideWhenUnavailable = false,
      onSetLink,
      onOpenChange,
      autoOpenOnLinkActive = false,
      onClick,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)
    const skipAutoOpen = useRef(false)

    const {
      isVisible,
      canSet,
      isActive,
      url,
      setUrl, documentId, setDocumentId, anchor, setAnchor,
      setLink,
      removeLink,
      openLink,
      label,
      Icon,
    } = useLinkPopover({
      editor,
      hideWhenUnavailable,
      onSetLink,
    })

    const shouldAutoOpen =
      autoOpenOnLinkActive && !!editor?.isFocused && isActive

    const handleOnOpenChange = useCallback(
      (nextIsOpen: boolean) => {
        setIsOpen(nextIsOpen)
        onOpenChange?.(nextIsOpen)
      },
      [onOpenChange]
    )

    const handleSetLink = useCallback(() => {
      skipAutoOpen.current = true
      setLink()
      setIsOpen(false)
    }, [setLink])

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        setIsOpen(!isOpen)
      },
      [onClick, isOpen]
    )

    useEffect(() => {
      if (shouldAutoOpen) {
        if (!skipAutoOpen.current) setIsOpen(true)
        skipAutoOpen.current = false
      }
    }, [shouldAutoOpen])

    if (!isVisible) {
      return null
    }

    return (
      <Popover open={isOpen} onOpenChange={handleOnOpenChange}>
        <PopoverTrigger asChild>
          <LinkButton
            disabled={!canSet}
            data-active-state={isActive ? "on" : "off"}
            data-disabled={!canSet}
            aria-label={label}
            aria-pressed={isActive}
            onClick={handleClick}
            {...buttonProps}
            ref={ref}
          >
            {children ?? <Icon className="tiptap-button-icon" />}
          </LinkButton>
        </PopoverTrigger>

        <PopoverContent collisionPadding={12} sticky="always">
          <LinkMain
            documentId={documentId} setDocumentId={setDocumentId} anchor={anchor} setAnchor={setAnchor}
            url={url}
            setUrl={setUrl}
            setLink={handleSetLink}
            removeLink={removeLink}
            openLink={openLink}
            isActive={isActive}
          />
        </PopoverContent>
      </Popover>
    )
  }
)

LinkPopover.displayName = "LinkPopover"

export default LinkPopover
