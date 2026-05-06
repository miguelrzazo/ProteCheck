# Protecheck

Tasks
 - [ ] icono
 - [ ] Definition de objetivos
 - [ ] Conseguir varios html de guardia
 - [x] Ver si se puede automatizar en apuntate que consiga solo los html en base a los NVOL
   - *Resultado*: No es posible. El portal usa JavaServer Faces (JSF) con `javax.faces.ViewState`. Las peticiones de "Informe Servicios" no envían el NVOL por parámetro, sino que dependen de la sesión del usuario conectado. No se puede suplantar la petición para descargar informes de otros voluntarios.

App Universal, ejecutable exe, Mac y linux

Onboarding Tutorial
Importar una lista en csv txt o  xlsx
