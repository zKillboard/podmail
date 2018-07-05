var currentFolder = 0;
var currentPage = 0;
var click = false;
var deltaCount = 1;
$( document ).ready(function() {
    loadFolders();
    setTimeout('checkDelta();', 1000);
    $('.gre').gre();
});

function loadFolders() {
    $("#pre-folders").load("/folders", loadedFolders);
}

function loadedFolders()
{
    console.log(currentFolder + ' - ' + currentPage);
    loadFolder(currentFolder, currentPage);
}

function loadFolderClick(id)
{
    click = true;
    currentPage = 0;
    loadFolder(id);
}

function loadFolder(id, page)
{
    var url = "/folder/" + id + '/' + page;
    console.log("Loading folder " + id);
    currentFolder = id;
    $("#listing").load(url, folderLoaded);
}

function loadPage(id, page)
{
    currentFolder = id;
    currentPage = page;
    $("#listing").load("/folder/" + id + '/' + page, folderLoaded);
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

    if (currentPage > 0) $('#prevpage').click(function() { loadPage(currentFolder, (currentPage - 1)); return false; });
    else $('#prevpage').removeAttr('href');
    if (currentPage < ($('#nextpage').attr('max') - 1)) $('#nextpage').click(function() { loadPage(currentFolder, (currentPage + 1)); return false; });
    else $('#nextpage').removeAttr('href');

    $("#compose-start").click(function() { compose(); return false; });
    console.log('loaded folder ' + currentFolder);
}

function mailClick(o)
{
    console.log(o.href);
    $("#mail").load(o.href, mailLoaded);
}

function mailLoaded()
{
    $("#showlisting").click(function() { showListing(); return false; });
    $('#unread_btn').click(function() { markMailUnread(this); });
    $('#delete_btn').confirm({title:'Deleting an EveMail', content: 'This action CANNOT be undone!<br/>Are you sure?', type: 'red', useBootstrap: true, autoClose: 'noop|5000', backgroundDismiss:true, escapeKey:true, buttons: {purge:{ text: 'DELETE', action: function() { deleteMail($('#delete_btn'));  } }, noop:{text:'Dismiss', action: function() {} }}});
    $("#reply_btn").click(function() { reply(); return false; });
    $("#forward_btn").click(function() { forward(); return false; });
    $("#unread").hide();
    $("#listing").hide();
    $("#mail").show();
    console.log('loaded mail');
}

function markMailUnread(btn)
{
    mail_id = $(btn).attr('mail_id');
    $("#mail-" + mail_id).addClass('unread');
    $("#unread").show();
    $.ajax('/action/mail/' + mail_id + '/is_read/false', {method: 'post'});
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

$(document).on('submit', '#compose_form', function() {            
        $("#compose-btn").attr("disabled", "disabled");
        $.ajax({
        url     : $(this).attr('action'),
        type    : $(this).attr('method'),
        dataType: 'json',
        data    : $(this).serialize(),
        success : function( data ) {
            console.log(data);
            if (data.error == false) {
                $.dialog({title: 'Sending EveMail...', content: data.message, type: 'green', backgroundDismiss:true, escapeKey:true});
                $("#mail").hide();
                $("#compose").hide();
                $("#listing").show();
            } else {
                $.dialog({title: 'Sending EveMail...', content: data.message, type: 'red'});
            }
            $("#compose-btn").removeAttr("disabled")
        },
        error   : function( xhr, err ) {
            alert('Error');     
            $("#compose-btn").removeAttr("disabled");
        }
        });    
        return false;
});

function compose_prepare(recips = '', subject = '', body = '')
{
    $("#recipients").val(recips);
    $("#subject").val(subject);
    $("iframe").remove();
    $("#body").val(body);
    $(".gre").gre();
}

function compose_show()
{
    $("#listing").hide();
    $("#mail").hide();
    $("#compose").show();
}

function compose()
{
    compose_prepare();
    compose_show();
}  

function reply()
{
    compose_prepare($("#mail-from").html(), "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();
}

function forward()
{
    compose_prepare('', "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();

}
