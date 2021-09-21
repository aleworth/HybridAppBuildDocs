$scheme
$wshell = New-Object -ComObject Wscript.Shell

npm run package
npm run platform:android
Set-Location .\build\
cordova plugin add cordova-plugin-customurlscheme --variable URL_SCHEME=$scheme
cordova plugin add cordova-plugin-browser
Set-Location ..

$Output = $wshell.Popup("The hybrid build has completed!")
