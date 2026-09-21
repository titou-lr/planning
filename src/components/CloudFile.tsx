import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes, type ReactElement, type ReactNode } from 'react'

function useFileSource(source: string | undefined): string | undefined {
  const [resolved, setResolved] = useState(source)
  useEffect(() => {
    let active = true
    setResolved(source)
    if (source?.startsWith('storage://')) {
      void import('../cloud/cloudFiles')
        .then(({ resolveCloudFileSource }) => resolveCloudFileSource(source))
        .then((value) => { if (active) setResolved(value) })
        .catch(() => { if (active) setResolved(undefined) })
    }
    return () => { active = false }
  }, [source])
  return resolved
}

export function CloudImage(props: ImgHTMLAttributes<HTMLImageElement>): ReactElement {
  const src = useFileSource(props.src)
  return <img {...props} src={src} />
}

export function CloudDownload({ src, name, className, style, children }: {
  src: string
  name: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}): ReactElement {
  const resolved = useFileSource(src)
  return <a href={resolved} download={name} className={className} style={style}>{children}</a>
}
