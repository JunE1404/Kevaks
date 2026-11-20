function accountSVG({className, color}: {className:string, color: string}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" 
        className={className}
        viewBox="0 0 24 24"
        fill={color ?? "currentColor"}
        aria-hidden="true"
        focusable="false">
        <path d="M5.85,17.1q1.27-0.98 2.85-1.54T12,15t3.3,0.56t2.85,1.54q0.88-1.03 1.36-2.33T20,12q0-3.33-2.34-5.66T12,4Q8.68,4 6.34,6.34T4,12q0,1.47 0.49,2.78q0.49,1.3 1.36,2.33Zm3.66-5.11Q8.5,10.98 8.5,9.5q0-1.48 1.01-2.49T12,6t2.49,1.01T15.5,9.5t-1.01,2.49T12,13q-1.47,0-2.49-1.01ZM12,22q-2.07,0-3.9-0.79q-1.82-0.79-3.17-2.14Q3.58,17.73 2.79,15.9T2,12Q2,9.92 2.79,8.1Q3.58,6.27 4.93,4.93Q6.28,3.57 8.1,2.79Q9.93,2 12,2t3.9,0.79t3.17,2.14q1.35,1.35 2.14,3.17Q22,9.92 22,12t-0.79,3.9t-2.14,3.17q-1.35,1.35-3.17,2.14T12,22Zm2.5-2.39q1.18-0.39 2.15-1.11q-0.98-0.73-2.15-1.11T12,17T9.5,17.39Q8.33,17.77 7.35,18.5q0.98,0.73 2.15,1.11T12,20t2.5-0.39Zm-1.42-9.04Q13.5,10.15 13.5,9.5T13.08,8.42T12,8T10.93,8.42T10.5,9.5t0.43,1.07T12,11t1.08-0.43ZM12,9.5Zm0,9Z"/>
    </svg>
  )
}

export function ControllerSVG({className, color}: {className:string, color: string}){
    return(

        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={className}
            viewBox="0 0 24 24"
            fill={color ?? "currentColor"}
            aria-hidden="true"
            focusable="false">
        <path d="M4.55,19q-1.27,0-1.97-0.89T2.05,15.95L3.1,8.45q0.23-1.5 1.34-2.48T7.05,5h9.9q1.5,0 2.61,0.97T20.9,8.45l1.05,7.5q0.17,1.28-0.53,2.16T19.45,19q-0.53,0-0.98-0.19t-0.82-0.56L15.4,16H8.6L6.35,18.25q-0.38,0.38-0.83,0.56T4.55,19Zm0.4-2.15L7.8,14h8.4l2.85,2.85Q19.1,16.9 19.45,17q0.27,0 0.44-0.16Q20.05,16.68 20,16.4L18.9,8.7q-0.1-0.73-0.65-1.21T16.95,7H7.05Q6.3,7 5.75,7.49Q5.2,7.97 5.1,8.7L4,16.4q-0.05,0.28 0.11,0.44Q4.28,17 4.55,17q0.05,0 0.4-0.15Zm12.76-4.14Q18,12.43 18,12t-0.29-0.71T17,11t-0.71,0.29T16,12t0.29,0.71T17,13t0.71-0.29Zm-2-3Q16,9.42 16,9q0-0.43-0.29-0.71T15,8T14.29,8.29T14,9q0,0.42 0.29,0.71T15,10t0.71-0.29ZM7.75,13h1.5V11.25H11V9.75H9.25V8H7.75V9.75H6v1.5H7.75V13ZM12,12Z"/></svg>
    )
}

export function HomeSVG({className, color}: {className:string, color: string}){
    return(

        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={className}
            viewBox="0 0 24 24"
            fill={color ?? "currentColor"}
            aria-hidden="true"
            focusable="false">
        <path d="M6,19H9V13h6v6h3V10L12,5.5L6,10v9ZM4,21V9l8-6l8,6V21H13V15H11v6H4Zm8-8.75Z"/></svg>
    )
}

export default accountSVG