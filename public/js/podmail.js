var currentFolder = 0;
var click = false;
var deltaCount = 1;
$( document ).ready(function() {
    loadFolders();
    setTimeout('checkDelta();', 1000);
});

function loadFolders() {
    $("#pre-folders").load("/folders", loadedFolders);
}

function loadedFolders()
{
    loadFolder(currentFolder);
}

function loadFolderClick(id)
{
    click = true;
    loadFolder(id);
}

function loadFolder(id)
{
    var url = "/folder/" + id;
    console.log("Loading folder " + id);
    currentFolder = id;
    $("#listing").load("/folder/" + id, folderLoaded);
}

function folderLoaded()
{
    console.log('Applying changes to folder ' + currentFolder);
    $(".folder-link").css("font-weight", "");
    $(".folder-" + currentFolder).css("font-weight", "bold");
    
    $(".subjectrow").click(function() { mailClick(this); return false; } );
    $("#folders").html($("#pre-folders").html());
    $(".folder-link").click(function (e) { loadFolderClick($(this).attr('folder')); return false; });
    if (click) {
        $("#mail").hide();
        $("#listing").show();
        click = false;
    }
    console.log('loaded folder ' + currentFolder);
}

function mailClick(o)
{
    console.log(o.href);
    $("#mail").load(o.href, mailLoaded);

    //$.ajax('/action/mail/' + id + '/is_read/true', {method: 'post'});
}

function mailLoaded()
{
    $("#listing").hide();
    $("#mail").show();
    $("#showlisting").click(function() { showListing(); return false; });
    $('#delete_btn').click(function() { deleteMail(this); return false; });
    console.log('loaded mail');
}

function deleteMail(btn) 
{
    mail_id = $(btn).attr('mail_id');
    $("#mail-" + mail_id).addClass('strike');
    $.ajax('/action/mail/' + mail_id + '/delete/now', {method: 'post', complete: mailDeleted});
}

function mailDeleted()
{
    showListing();
}

function showListing()
{
    $("#mail").hide();
    $("#listing").show();
}

function checkDelta()
{
    setTimeout('checkDelta();', deltaCount * 1000);
    $.ajax('/delta', {success: processDelta});
}

function forceDelta()
{
    processDelta('1');
}

function processDelta(text)
{
    if (text == '1') {
        console.log('delta detected');
        loadFolders();
        deltaCount = 1;
    } else if (deltaCount < 300) deltaCount++;
}
